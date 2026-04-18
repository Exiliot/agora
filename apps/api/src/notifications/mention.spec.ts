import { describe, it, expect } from 'vitest';
import { extractMentions } from './mention.js';

describe('extractMentions', () => {
  it('returns empty array when none', () => {
    expect(extractMentions('no mentions here')).toEqual([]);
  });

  it('extracts a simple mention', () => {
    expect(extractMentions('hi @bob')).toEqual(['bob']);
  });

  it('dedupes repeated mentions case-insensitively', () => {
    expect(extractMentions('@Bob @bob @BOB')).toEqual(['bob']);
  });

  it('stops at punctuation', () => {
    expect(extractMentions('hello @bob, how are you?')).toEqual(['bob']);
  });

  it('ignores emails', () => {
    expect(extractMentions('mail me at bob@agora.test')).toEqual([]);
  });

  it('accepts underscores, dots, dashes', () => {
    expect(extractMentions('@bob.the_builder-1')).toEqual(['bob.the_builder-1']);
  });

  it('extracts multiple distinct mentions', () => {
    expect(extractMentions('@bob and @alice')).toEqual(['bob', 'alice']);
  });

  it('works at start of string', () => {
    expect(extractMentions('@bob morning')).toEqual(['bob']);
  });
});
