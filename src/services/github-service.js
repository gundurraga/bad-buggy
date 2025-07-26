const core = require("@actions/core");

class GitHubService {
  constructor(octokit, context) {
    this.octokit = octokit;
    this.context = context;
  }

  async getPRDiff(pr, config) {
    try {
      const response = await this.octokit.rest.pulls.get({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        pull_number: pr.number,
        mediaType: {
          format: "diff",
        },
      });

      return response.data;
    } catch (error) {
      core.error(`Failed to get PR diff: ${error.message}`);
      return "";
    }
  }

  async postReview(pr, comments, costSummary) {
    let reviewBody = `bad-buggy review completed with ${comments.length} comments\n\n${costSummary}`;

    if (comments.length === 0) {
      reviewBody = `bad-buggy found no issues! Great job! 🎉\n\n${costSummary}`;
      await this._postComment(pr, reviewBody);
      return;
    }

    // Create review with comments
    const review = {
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      pull_number: pr.number,
      event: "COMMENT",
      body: reviewBody,
      comments: comments.map((c) => ({
        path: c.file,
        line: c.line || 1,
        body: `**${c.severity}** (${c.category}): ${c.comment}`,
      })),
    };

    try {
      await this.octokit.rest.pulls.createReview(review);
      core.info(`Posted ${comments.length} review comments`);
    } catch (error) {
      core.error(`Failed to post review: ${error.message}`);
      // Fall back to posting as individual comments
      await this._fallbackToComments(pr, comments);
    }
  }

  async _postComment(pr, body) {
    await this.octokit.rest.issues.createComment({
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      issue_number: pr.number,
      body,
    });
  }

  async _fallbackToComments(pr, comments) {
    for (const comment of comments) {
      try {
        await this._postComment(pr, `**${comment.file}**: ${comment.comment}`);
      } catch (e) {
        core.error(`Failed to post comment: ${e.message}`);
      }
    }
  }
}

module.exports = { GitHubService };
