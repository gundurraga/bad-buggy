class CommentProcessor {
  constructor(config) {
    this.config = config;
  }

  process(comments) {
    // Remove duplicates
    const unique = this._removeDuplicates(comments);

    // Sort by severity if needed
    const sorted = this._sortBySeverity(unique);

    // Limit number of comments
    return sorted.slice(0, this.config.max_comments);
  }

  _removeDuplicates(comments) {
    return comments.filter(
      (comment, index, self) =>
        index ===
        self.findIndex(
          (c) => c.file === comment.file && c.line === comment.line
        )
    );
  }

  _sortBySeverity(comments) {
    if (!this.config.prioritize_by_severity) {
      return comments;
    }

    const severityOrder = {
      critical: 0,
      major: 1,
      minor: 2,
      suggestion: 3,
    };

    return comments.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  }

  chunkDiff(diff) {
    // For now, return the whole diff as one chunk
    // TODO: Implement intelligent chunking for large diffs
    return [diff];
  }
}

module.exports = { CommentProcessor };
