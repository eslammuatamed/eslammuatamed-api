import { deriveReplySubject } from './reply-subject';

describe('deriveReplySubject', () => {
  it('prefixes a plain subject with "Re: "', () => {
    expect(deriveReplySubject('Website enquiry')).toBe('Re: Website enquiry');
  });

  // The reason the helper exists. Without the guard, replying to a reply — or to a visitor whose
  // own client already prefixed the subject — accumulates prefixes on every round trip.
  it('does not produce "Re: Re:" when the subject already carries a reply prefix', () => {
    expect(deriveReplySubject('Re: Website enquiry')).toBe(
      'Re: Website enquiry',
    );
  });

  it.each([
    ['RE: Website enquiry'],
    ['re: Website enquiry'],
    ['rE: Website enquiry'],
  ])('recognises the prefix case-insensitively: %s', (subject) => {
    expect(deriveReplySubject(subject)).toBe(subject);
  });

  it('recognises the prefix with whitespace before the colon', () => {
    expect(deriveReplySubject('Re : Website enquiry')).toBe(
      'Re : Website enquiry',
    );
  });

  it('trims surrounding whitespace on both paths', () => {
    expect(deriveReplySubject('  Website enquiry  ')).toBe(
      'Re: Website enquiry',
    );
    expect(deriveReplySubject('  Re: Website enquiry  ')).toBe(
      'Re: Website enquiry',
    );
  });

  // Anchored, so the guard cannot be tripped by a subject that merely CONTAINS the token. A
  // subject about a "Core: Re: architecture" ticket is not already a reply.
  it('only recognises the prefix at the start of the subject', () => {
    expect(deriveReplySubject('Question re: the timeline')).toBe(
      'Re: Question re: the timeline',
    );
  });

  // The property that actually matters: the same original can be replied to many times, and each
  // reply derives from the ORIGINAL. Idempotence is what keeps every one of them agreeing.
  it('is idempotent', () => {
    const once = deriveReplySubject('Website enquiry');

    expect(deriveReplySubject(once)).toBe(once);
    expect(deriveReplySubject(deriveReplySubject(once))).toBe(once);
  });

  // Not a general prefix parser, and this pins that boundary so a future reader does not mistake
  // the omission for an oversight. A localized prefix is treated as ordinary subject text.
  it('does not attempt to recognise localized reply prefixes', () => {
    expect(deriveReplySubject('رد: استفسار')).toBe('Re: رد: استفسار');
    expect(deriveReplySubject('Antw: Anfrage')).toBe('Re: Antw: Anfrage');
  });
});
