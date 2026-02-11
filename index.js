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
    const response = await axios.post(
      "https://api.todoist.com/api/v1/sync",
      {
        sync_token: "*",
        resource_types: '["stats", "user"]'
      },
      {
        headers: {
          Authorization: `Bearer ${TODOIST_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    // Debug: log all available response keys
    core.info("Response keys: " + Object.keys(response.data).join(", "));

    // Check for user object (may contain karma)
    if (response.data.user) {
      core.info("User object: " + JSON.stringify(response.data.user, null, 2));
    }

    // V1 API nests stats in response object
    const stats = response.data.stats;
    if (!stats) {
      core.error("Stats not found in API response. Available keys: " + Object.keys(response.data).join(", "));
      core.setFailed("Todoist API did not return stats data");
      return;
    }

    // Debug: log the actual stats structure to understand v1 format
    core.info("Stats structure: " + JSON.stringify(stats, null, 2));

    // Merge user data into stats if available (karma lives in user object in v1)
    const user = response.data.user || {};
    await updateReadme(stats, user);
  } catch (error) {
    handleApiError(error);
  }
}

let todoist = [];
let jobFailFlag = false;
const README_FILE_PATH = "./README.md";

async function updateReadme(data, user = {}) {
  // Log available fields for debugging
  core.info("Available stats fields: " + Object.keys(data).join(", "));
  core.info("Available user fields: " + Object.keys(user).join(", "));

  const { completed_count, days_items, goals, week_items } = data;

  // Karma points - in v1 API, karma is in the user object, not stats
  const karma = user.karma || data.karma;
  if (karma !== undefined) {
    const karmaPoint = [`🏆  **${Humanize.intComma(karma)}** Karma Points`];
    todoist.push(karmaPoint);
  } else {
    core.warning("karma field not found in stats or user object");
  }

  // Daily tasks
  if (days_items && days_items[0] && days_items[0].total_completed !== undefined) {
    const dailyGoal = [
      `🌸  Completed **${days_items[0].total_completed.toString()}** tasks today`,
    ];
    todoist.push(dailyGoal);
  } else {
    core.warning("days_items field not found or empty in stats");
  }

  // Weekly tasks (premium only)
  if (PREMIUM == "true") {
    if (week_items && week_items[0] && week_items[0].total_completed !== undefined) {
      const weekItems = [
        `🗓  Completed **${week_items[0].total_completed.toString()}** tasks this week`,
      ];
      todoist.push(weekItems);
    } else {
      core.warning("week_items field not found or empty in stats (premium feature)");
    }
  }

  // Total completed tasks
  if (completed_count !== undefined) {
    const totalTasks = [
      `✅  Completed **${Humanize.intComma(completed_count)}** tasks so far`,
    ];
    todoist.push(totalTasks);
  } else {
    core.warning("completed_count field not found in stats");
  }

  // Longest streak - check both stats.goals and user object
  const maxStreak = goals?.max_daily_streak?.count || user.max_daily_streak || user.daily_goal;
  if (maxStreak !== undefined) {
    const longestStreak = [
      `⏳  Longest streak is **${maxStreak}** days`,
    ];
    todoist.push(longestStreak);
  } else {
    core.warning("Streak data not found. Goals: " + JSON.stringify(goals) + ", User goal fields: daily_goal=" + user.daily_goal);
  }

  if (todoist.length == 0) return;

  if (todoist.length > 0) {
    // console.log(todoist.length);
    // const showTasks = todoist.reduce((todo, cur, index) => {
    //   return todo + `\n${cur}        ` + (((index + 1) === todoist.length) ? '\n' : '');
    // })
    const readmeData = fs.readFileSync(README_FILE_PATH, "utf8");

    const newReadme = buildReadme(readmeData, todoist.join("           \n"));
    if (newReadme !== readmeData) {
      core.info("Writing to " + README_FILE_PATH);
      fs.writeFileSync(README_FILE_PATH, newReadme);
      if (!process.env.TEST_MODE) {
        commitReadme();
      }
    } else {
      core.info("No change detected, skipping");
      process.exit(0);
    }
  } else {
    core.info("Nothing fetched");
    process.exit(jobFailFlag ? 1 : 0);
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
  // Making job fail if one of the source fails
  process.exit(jobFailFlag ? 1 : 0);
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
