export type Platform = 'blog' | 'linkedin' | 'substack' | 'twitter';

export type ContentFormat = 'blog' | 'linkedin' | 'twitter' | 'substack';

export interface ClaudePenConfig {
  author: string;
  llm: {
    provider: 'anthropic';
    model: string;
    apiKeyEnv: string;  // Name of env var containing API key
  };
}

export interface DraftMetadata {
  format: ContentFormat;
  created: string;
  source?: string;
  word_count?: number;
  [key: string]: unknown;
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

export interface DraftOptions {
  output?: string;
  stdin?: boolean;
  format?: ContentFormat;
  instruct?: string;  // Custom instructions for the LLM
}

export interface RefineOptions {
  output?: string;
  instruct?: string;  // Custom instructions (migrating from positional arg)
}

export interface ShipOptions {
  instruct?: string;  // Custom instructions for the LLM
}

export interface ReviewOptions {
  output?: string;
  instruct?: string;  // Custom instructions for the LLM
}
