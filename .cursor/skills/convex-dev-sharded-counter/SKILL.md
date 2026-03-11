---
name: convex-dev-sharded-counter
description: High-performance counter component for Convex that uses database sharding to handle concurrent increments without write conflicts. Use when working with Convex counters, sharded counters, high-throughput counters, write conflicts, like buttons, voting systems, or view counts.
---

# Sharded Counter

## Instructions

Sharded Counter is a Convex component that provides high-performance counters using database sharding to avoid write conflicts on concurrent increments.

### Installation

```bash
npm install @convex-dev/sharded-counter
```

### Capabilities

- Eliminate write conflicts when multiple users increment counters simultaneously
- Scale to thousands of concurrent counter operations without database bottlenecks
- Implement view counts, like buttons, and voting systems with guaranteed consistency
- Reduce counter-related performance issues in high-traffic applications

## Examples

### High-throughput counters in Convex

The component distributes counter operations across multiple database shards to prevent write conflicts. It manages shard allocation and provides atomic increment/decrement operations that scale with concurrent usage.

### Convex counter with concurrent updates

Use the Sharded Counter when many users update the same counter at once. It splits counter state across multiple documents, removing the single-document write bottleneck that causes conflicts in traditional counters.

### Scalable like button or voting counter

The Sharded Counter supports like buttons and voting systems with hundreds of concurrent interactions. Reads aggregate shard values consistently; increments can run concurrently without write conflicts.

## Troubleshooting

**How does sharded counter improve performance over regular Convex counters?**

State is split across multiple database documents instead of one. Simultaneous increments no longer hit the same document, so write conflicts are eliminated and throughput increases.

**Eventually consistent or strongly consistent?**

Strong consistency for each increment (atomic within its shard). Reads are eventually consistent: they aggregate all shards to return the current total.

**How many concurrent operations can it handle?**

It scales with contention and can handle thousands of concurrent increments. Shard allocation is managed dynamically to spread load and avoid single-shard bottlenecks.

**Can I use it for decrementing?**

Yes. The component supports both increment and decrement, distributed across shards the same way (e.g. upvote/downvote or inventory).

## Resources

- [npm package](https://www.npmjs.com/package/%40convex-dev%2Fsharded-counter)
- [GitHub repository](https://github.com/get-convex/sharded-counter)
- [Convex Components Directory](https://www.convex.dev/components/sharded-counter)
- [Convex documentation](https://docs.convex.dev)
