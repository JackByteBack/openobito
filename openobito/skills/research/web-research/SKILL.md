---
name: web-research
description: "Structured web research: search, extract, synthesize, and cite sources accurately."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  openagent:
    tags: [research, web, search, synthesis, citations, fact-checking]
    category: research
    related_skills: [documentation, writing]
    tools: [web_fetch, read_file, write_file]
    risk: low
---

# Web Research

Structured approach to web research: form hypotheses, search multiple sources, extract evidence, cross-verify, and synthesize into a well-cited answer. Guards against hallucination by requiring source links for every factual claim.

## When to Use

- Answering questions about current events, APIs, libraries, or technologies
- Comparing options before making technical decisions
- Fact-checking claims before including them in documents or code
- Building a knowledge base on a specific topic
- Researching third-party library behavior, changelogs, or known issues

## Prerequisites

- `web_fetch` tool available and network accessible
- A clear research question or hypothesis to test

## How to Run

Invoke via `/skills use web-research` or ask:

> "Research the best approach for streaming LLM responses in Node.js"

## Quick Reference

1. Formulate the question precisely
2. Identify 3–5 authoritative source types
3. Fetch and extract each source
4. Cross-verify conflicting claims
5. Synthesize with inline citations

## Procedure

### 1. Formulate the Research Question

Before fetching anything, write a precise question:

**Bad**: "Tell me about authentication"
**Good**: "What are the security differences between JWT (HS256) and session cookies for a single-server Node.js API as of 2024?"

Precision prevents rabbit holes. If the question is compound, split it.

### 2. Identify Source Types

For each question, plan which source types to check:

| Question type | Preferred sources |
|---|---|
| Library/API behavior | Official docs, GitHub repo, changelog |
| Security topics | CVE database, OWASP, security advisories |
| Best practices | RFC documents, official guidelines, high-reputation blogs |
| Comparisons | Benchmarks with reproducible methodology, not opinion pieces |
| Current events | Multiple news sources, official announcements |

Plan 3–5 sources minimum. Prioritize primary over secondary sources.

### 3. Fetch and Extract

For each source:

```
[fetch] https://official-source.example.com/docs/topic
```

Extract only the relevant section. Do not summarize the entire page — quote specifically.

For documentation pages, look for:
- Version/date at the top
- The specific API or behavior being researched
- Any deprecation notices

### 4. Cross-Verify Conflicting Claims

If two sources disagree:
- Check the date of each source (prefer more recent)
- Check the version of the software each refers to
- Prefer primary (official) over secondary (blog/forum)
- Note the discrepancy explicitly in the output

Never silently pick one side.

### 5. Identify Knowledge Gaps

After reading sources, explicitly note what could not be confirmed:

> "The official docs do not specify behavior when the token expires mid-request. Stack Overflow answers suggest X, but this is not authoritative."

### 6. Synthesize and Cite

Produce a structured answer:

```markdown
## Finding: [topic]

**Summary**: [2-3 sentence synthesis]

**Evidence**:
1. [Claim A] — Source: [Title](URL) (retrieved [date])
2. [Claim B] — Source: [Title](URL)

**Unconfirmed / Gaps**:
- [Claim C could not be verified from primary sources]

**Recommendation**: [actionable conclusion]
```

Every factual claim must have a source link. "I believe" or "probably" without a source is not acceptable.

## Pitfalls

- **Citing LLM knowledge as fact**: The agent's training knowledge is not a citable source. Always fetch from the actual web.
- **Single-source research**: One source can be wrong, outdated, or biased. Minimum three.
- **Ignoring version specificity**: A Stack Overflow answer from 2019 may be wrong for the current version. Always note versions.
- **Summarizing without reading**: Fetching a page and summarizing without extracting specific evidence leads to confident-sounding hallucination.
- **Conflating opinion with documentation**: Blog posts, Reddit, and HN are secondary sources. Flag them as such.
- **Not checking publication date**: Always note when each source was last updated.

## Verification

After synthesis:

- Every factual claim has an inline citation with a URL
- At least 3 distinct primary sources consulted
- Conflicting claims noted explicitly, not silently resolved
- Knowledge gaps disclosed
- No claim made from LLM training knowledge without a source
