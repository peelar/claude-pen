export type Platform = 'blog' | 'linkedin' | 'substack' | 'twitter';

export type RefinePass = 'proofread' | 'punchier' | 'clarity';

export interface ClaudePenConfig {
  author: string;
  llm: {
    provider: 'anthropic';
    model: string;
    apiKeyEnv: string;  // Name of env var containing API key
  };
}

export interface ArticleFrontmatter {
  title: string;
  date: string;
  platform: Platform;
  url?: string;
  word_count: number;
  tags: string[];
  summary?: string;
}
