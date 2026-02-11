const core = require("@actions/core");
const axios = require("axios");
const Humanize = require("humanize-plus");
const fs = require("fs");
const exec = require("./exec");
const axiosRetry = require("axios-retry").default;

// Configure retry behavior for rate limits and transient errors
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    // Respect Retry-After header if present
    const retryAfter = error.response?.headers?.["retry-after"];
    if (retryAfter) {
      core.info(`Rate limited. Waiting ${retryAfter}s as requested by Todoist.`);
      return parseInt(retryAfter, 10) * 1000;
    }
    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, retryCount - 1) * 1000;
    core.info(`Retrying in ${delay / 1000}s (attempt ${retryCount}/3)`);
    return delay;
  },
  retryCondition: (error) => {
    // Retry on rate limit (429) and server errors (5xx)
    const status = error.response?.status;
    return (
      axiosRetry.isNetworkError(error) ||
      status === 429 ||
      (status >= 500 && status < 600)
    );
  },
  onRetry: (retryCount, error, requestConfig) => {
    core.warning(`Todoist API request failed, retrying (attempt ${retryCount}): ${error.message}`);
  }
});

const TODOIST_API_KEY = core.getInput("TODOIST_API_KEY");
const PREMIUM = core.getInput("PREMIUM");

async function main() {
  try {
    // Use the dedicated productivity stats REST endpoint (not sync)
    // Docs: https://developer.todoist.com/api/v1/#tag/User/operation/get_productivity_stats_api_v1_tasks_completed_stats_get
    const response = await axios.get(
      "https://api.todoist.com/api/v1/tasks/completed/stats",
      {
        headers: {
          Authorization: `Bearer ${TODOIST_API_KEY}`
        },
        timeout: 10000
      }
    );

    const stats = response.data;
    if (!stats) {
      core.setFailed("Todoist API did not return stats data");
      return;
    }

    await updateReadme(stats);
  } catch (error) {
    handleApiError(error);
  }
}

const README_FILE_PATH = "./README.md";

// Stat formatter functions - reusable for both legacy and granular tag modes
function formatKarmaStat(karma) {
  if (karma === undefined) return null;
  return `🏆  **${Humanize.intComma(karma)}** Karma Points`;
}

function formatDailyTasksStat(days_items) {
  const count = days_items?.[0]?.total_completed;
  if (count === undefined) return null;
  return `🌸  Completed **${count}** tasks today`;
}

function formatWeeklyTasksStat(week_items, isPremium) {
  if (!isPremium) return null;
  const count = week_items?.[0]?.total_completed;
  if (count === undefined) return null;
  return `🗓  Completed **${count}** tasks this week`;
}

function formatTotalTasksStat(completed_count) {
  if (completed_count === undefined) return null;
  return `✅  Completed **${Humanize.intComma(completed_count)}** tasks so far`;
}

function formatCurrentStreakStat(goals) {
  const count = goals?.current_daily_streak?.count;

  if (count === undefined) return null;

  if (count === 0) {
    return `🔥  Current streak: **0 days** - Start one today!`;
  }

  const days = count === 1 ? 'day' : 'days';
  return `🔥  Current streak: **${count} ${days}**`;
}

function formatLongestStreakStat(goals) {
  const count = goals?.max_daily_streak?.count;
  if (count === undefined) return null;
  return `⏳  Longest streak is **${count}** days`;
}

// Granular tag configuration - maps tag names to formatter functions
const TAG_CONFIG = {
  'TODO-IST-KARMA': (data) => formatKarmaStat(data.karma),
  'TODO-IST-DAILY': (data) => formatDailyTasksStat(data.days_items),
  'TODO-IST-WEEKLY': (data) => formatWeeklyTasksStat(data.week_items, PREMIUM === "true"),
  'TODO-IST-TOTAL': (data) => formatTotalTasksStat(data.completed_count),
  'TODO-IST-CURRENT-STREAK': (data) => formatCurrentStreakStat(data.goals),
  'TODO-IST-LONGEST-STREAK': (data) => formatLongestStreakStat(data.goals)
};

function detectDisplayMode(readmeContent) {
  const hasLegacyTags = readmeContent.includes('<!-- TODO-IST:START -->') &&
                        readmeContent.includes('<!-- TODO-IST:END -->');

  const hasGranularTags = Object.keys(TAG_CONFIG).some(tag =>
    readmeContent.includes(`<!-- ${tag}:START -->`)
  );

  if (hasGranularTags) return 'granular';
  if (hasLegacyTags) return 'legacy';
  return 'none';
}

function replaceTag(content, tagName, newContent) {
  const startTag = `<!-- ${tagName}:START -->`;
  const endTag = `<!-- ${tagName}:END -->`;

  const startIndex = content.indexOf(startTag);
  if (startIndex === -1) {
    core.warning(`${tagName}: Start tag not found`);
    return content;
  }

  const endIndex = content.indexOf(endTag, startIndex);
  if (endIndex === -1) {
    core.warning(`${tagName}: End tag not found (start tag exists at position ${startIndex})`);
    return content;
  }

  const endOfStartTag = startIndex + startTag.length;

  return [
    content.slice(0, endOfStartTag),
    '\n',
    newContent,
    '\n',
    content.slice(endIndex)
  ].join('');
}

function detectUnknownTags(readmeContent) {
  // Find all TODO-IST-* tags that aren't in our config
  const tagPattern = /<!-- (TODO-IST-[A-Z-]+):START -->/g;
  const validTags = Object.keys(TAG_CONFIG);
  const unknownTags = [];

  let match;
  while ((match = tagPattern.exec(readmeContent)) !== null) {
    const foundTag = match[1];
    if (!validTags.includes(foundTag)) {
      unknownTags.push(foundTag);
    }
  }

  return unknownTags;
}

function updateReadmeGranular(data, readmeContent) {
  // Check for potential typos
  const unknownTags = detectUnknownTags(readmeContent);
  if (unknownTags.length > 0) {
    core.warning(`Unknown tag(s) found: ${unknownTags.join(', ')}`);
    core.warning(`Valid tags are: ${Object.keys(TAG_CONFIG).join(', ')}`);
  }

  let updated = readmeContent;
  let processedTags = [];
  let skippedTags = [];

  for (const [tagName, formatter] of Object.entries(TAG_CONFIG)) {
    const startTag = `<!-- ${tagName}:START -->`;

    if (readmeContent.includes(startTag)) {
      const formattedStat = formatter(data);

      if (formattedStat !== null) {
        updated = replaceTag(updated, tagName, formattedStat);
        processedTags.push(tagName);
      } else {
        // Stat unavailable (e.g., premium feature for free user)
        skippedTags.push(tagName);
        core.warning(`${tagName}: Stat unavailable (check premium status or API response)`);
      }
    }
  }

  if (processedTags.length > 0) {
    core.info(`Updated ${processedTags.length} stat(s): ${processedTags.join(', ')}`);
  }

  if (skippedTags.length > 0) {
    core.info(`Skipped ${skippedTags.length} unavailable stat(s): ${skippedTags.join(', ')}`);
  }

  if (processedTags.length === 0 && skippedTags.length === 0) {
    core.warning('No valid TODO-IST granular tags found in README');
  }

  return updated;
}

function updateReadmeLegacy(data, readmeContent) {
  const { karma, completed_count, days_items, goals, week_items } = data;

  const stats = [
    formatKarmaStat(karma),
    formatDailyTasksStat(days_items),
    formatWeeklyTasksStat(week_items, PREMIUM === "true"),
    formatTotalTasksStat(completed_count),
    formatCurrentStreakStat(goals),
    formatLongestStreakStat(goals)
  ].filter(Boolean);

  if (stats.length === 0) {
    core.warning('No stats available to display');
    return readmeContent;
  }

  return buildReadme(readmeContent, stats.join("           \n"));
}

async function updateReadme(data) {
  const readmeContent = fs.readFileSync(README_FILE_PATH, "utf8");
  const mode = detectDisplayMode(readmeContent);

  core.info(`Display mode detected: ${mode}`);

  if (mode === 'none') {
    core.error('No TODO-IST tags found in README. Add either:\n' +
               '  - Legacy: <!-- TODO-IST:START --> and <!-- TODO-IST:END -->\n' +
               '  - Granular: <!-- TODO-IST-KARMA:START --> etc.');
    process.exit(1);
  }

  let newReadme;

  if (mode === 'granular') {
    newReadme = updateReadmeGranular(data, readmeContent);
  } else {
    // Legacy mode - build all stats together
    newReadme = updateReadmeLegacy(data, readmeContent);
  }

  if (newReadme !== readmeContent) {
    core.info("Writing to " + README_FILE_PATH);
    fs.writeFileSync(README_FILE_PATH, newReadme);
    if (!process.env.TEST_MODE) {
      commitReadme();
    }
  } else {
    core.info("No change detected, skipping");
    process.exit(0);
  }
}

// console.log(todoist.length);

const buildReadme = (prevReadmeContent, newReadmeContent) => {
  const tagToLookFor = "<!-- TODO-IST:";
  const closingTag = "-->";
  const startOfOpeningTagIndex = prevReadmeContent.indexOf(
    `${tagToLookFor}START`
  );
  const endOfOpeningTagIndex = prevReadmeContent.indexOf(
    closingTag,
    startOfOpeningTagIndex
  );
  const startOfClosingTagIndex = prevReadmeContent.indexOf(
    `${tagToLookFor}END`,
    endOfOpeningTagIndex
  );
  if (
    startOfOpeningTagIndex === -1 ||
    endOfOpeningTagIndex === -1 ||
    startOfClosingTagIndex === -1
  ) {
    core.error(
      `Cannot find the comment tag on the readme:\n<!-- ${tagToLookFor}:START -->\n<!-- ${tagToLookFor}:END -->`
    );
    process.exit(1);
  }
  return [
    prevReadmeContent.slice(0, endOfOpeningTagIndex + closingTag.length),
    "\n",
    newReadmeContent,
    "\n",
    prevReadmeContent.slice(startOfClosingTagIndex),
  ].join("");
};

const commitReadme = async () => {
  // Getting config
  const committerUsername = "Abhishek Naidu";
  const committerEmail = "example@gmail.com";
  const commitMessage = "Todoist updated.";
  // Doing commit and push
  await exec("git", ["config", "--global", "user.email", committerEmail]);
  await exec("git", ["config", "--global", "user.name", committerUsername]);
  await exec("git", ["add", README_FILE_PATH]);
  await exec("git", ["commit", "-m", commitMessage]);
  // await exec('git', ['fetch']);
  await exec("git", ["push"]);
  core.info("Readme updated successfully.");
};

function handleApiError(error) {
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const message = error.response.data?.message || error.message;

    if (status === 401) {
      core.setFailed("Authentication failed. Check your TODOIST_API_KEY is valid.");
    } else if (status === 403) {
      core.setFailed("Access forbidden. Your API key may lack required permissions.");
    } else if (status === 404) {
      core.setFailed("Stats endpoint not found. Todoist API may have changed.");
    } else if (status === 429) {
      // Rate limit - this should be handled by axios-retry, but if we get here:
      core.setFailed("Rate limited by Todoist API. Try again later.");
    } else if (status >= 500) {
      core.setFailed(`Todoist server error (${status}). Try again later.`);
    } else {
      core.setFailed(`Todoist API error (${status}): ${message}`);
    }
  } else if (error.code === "ECONNABORTED") {
    core.setFailed("Request timed out. Todoist API may be slow or unreachable.");
  } else if (error.request) {
    // Request made but no response received
    core.setFailed("No response from Todoist API. Check network connectivity.");
  } else {
    // Error setting up request
    core.setFailed(`Failed to call Todoist API: ${error.message}`);
  }
}

(async () => {
  await main();
})();
