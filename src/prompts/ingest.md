You are analyzing a piece of writing to extract metadata.

Given the following article, extract:
- title: The title (infer from content if not explicitly stated)
- date: Publication date if mentioned (YYYY-MM-DD format), otherwise null
- tags: 3-5 relevant topic tags as an array
- summary: 1-2 sentence summary

Respond with ONLY valid YAML, no markdown code fences, no explanation:

title: "The extracted or inferred title"
date: YYYY-MM-DD
tags: [tag1, tag2, tag3]
summary: "Brief summary of the content"

If no date is found, use:
date: null

Article to analyze:

{{content}}
