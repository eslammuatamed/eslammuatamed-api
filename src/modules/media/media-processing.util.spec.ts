import {
  encodeWithinBudget,
  fileExtension,
  hasPdfStructure,
  sanitizeFilename,
} from './media-processing.util';

describe('encodeWithinBudget (doc 20 §4 quality ladder, D20-6)', () => {
  it('keeps the start quality when the first encode already fits the budget', async () => {
    const calls: number[] = [];
    const encode = (quality: number): Promise<Buffer> => {
      calls.push(quality);
      return Promise.resolve(Buffer.alloc(50)); // under budget
    };

    const result = await encodeWithinBudget(encode, {
      startQuality: 78,
      floorQuality: 55,
      step: 8,
      budgetBytes: 100,
    });

    expect(result.quality).toBe(78);
    expect(result.overBudget).toBe(false);
    expect(result.buffer.length).toBe(50);
    expect(calls).toEqual([78]);
  });

  it('steps quality down by the exact rule nextQuality = max(floor, current − step)', async () => {
    // Every encode is over budget so the ladder walks all the way to the floor.
    const calls: number[] = [];
    const encode = (quality: number): Promise<Buffer> => {
      calls.push(quality);
      return Promise.resolve(Buffer.alloc(1000)); // always over budget
    };

    const result = await encodeWithinBudget(encode, {
      startQuality: 78,
      floorQuality: 55,
      step: 8,
      budgetBytes: 100,
    });

    // 78 → 70 → 62 → 55 (62 − 8 = 54, clamped up to the floor 55)
    expect(calls).toEqual([78, 70, 62, 55]);
    expect(result.quality).toBe(55);
    expect(result.overBudget).toBe(true);
  });

  it('walks the AVIF ladder 55 → 47 → 40 and stops at the floor', async () => {
    const calls: number[] = [];
    const encode = (quality: number): Promise<Buffer> => {
      calls.push(quality);
      return Promise.resolve(Buffer.alloc(1000));
    };

    const result = await encodeWithinBudget(encode, {
      startQuality: 55,
      floorQuality: 40,
      step: 8,
      budgetBytes: 100,
    });

    // 55 → 47 → 40 (47 − 8 = 39, clamped up to the floor 40)
    expect(calls).toEqual([55, 47, 40]);
    expect(result.quality).toBe(40);
    expect(result.overBudget).toBe(true);
  });

  it('stops as soon as a stepped-down quality fits the budget', async () => {
    const calls: number[] = [];
    // Over budget at 78, under budget from 70 onwards.
    const encode = (quality: number): Promise<Buffer> => {
      calls.push(quality);
      return Promise.resolve(Buffer.alloc(quality >= 78 ? 1000 : 50));
    };

    const result = await encodeWithinBudget(encode, {
      startQuality: 78,
      floorQuality: 55,
      step: 8,
      budgetBytes: 100,
    });

    expect(calls).toEqual([78, 70]);
    expect(result.quality).toBe(70);
    expect(result.overBudget).toBe(false);
  });
});

describe('sanitizeFilename (doc 19 §5 — display/search metadata only)', () => {
  it('strips directory components and path traversal', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('/var/www/resume.pdf')).toBe('resume.pdf');
    expect(sanitizeFilename('C:\\Users\\me\\cv.pdf')).toBe('cv.pdf');
  });

  it('replaces unsafe characters and collapses runs to a single underscore', () => {
    expect(sanitizeFilename('my résumé (2024)!!!.pdf')).toBe(
      'my_resume_2024_.pdf',
    );
  });

  it('preserves the extension and keeps a readable base', () => {
    expect(sanitizeFilename('Head Shot.JPG')).toBe('Head_Shot.JPG');
  });

  it('strips leading dots so the result is never a hidden file', () => {
    expect(sanitizeFilename('...hidden.pdf')).toBe('hidden.pdf');
  });

  it('falls back to a safe name when nothing usable remains', () => {
    expect(sanitizeFilename('   ')).toBe('file');
    expect(sanitizeFilename('')).toBe('file');
  });

  it('caps an excessively long name while keeping the extension', () => {
    const long = `${'a'.repeat(500)}.pdf`;
    const result = sanitizeFilename(long);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith('.pdf')).toBe(true);
  });
});

describe('fileExtension (validated before sanitization — doc 19 §5)', () => {
  it('returns the lowercased extension of the basename', () => {
    expect(fileExtension('resume.pdf')).toBe('pdf');
    expect(fileExtension('photo.jpeg')).toBe('jpeg');
    expect(fileExtension('/var/www/file.PNG')).toBe('png');
    expect(fileExtension('C:\\Users\\me\\HEAD.JPG')).toBe('jpg');
  });

  it('matches case-insensitively (uppercase extensions)', () => {
    expect(fileExtension('PHOTO.JPG')).toBe('jpg');
    expect(fileExtension('DOC.PDF')).toBe('pdf');
  });

  it('uses only the final extension of a multi-dot name', () => {
    expect(fileExtension('archive.tar.gz')).toBe('gz');
  });

  it('returns an empty string when there is no real extension', () => {
    expect(fileExtension('noextension')).toBe('');
    expect(fileExtension('.hidden')).toBe(''); // dotfile, not an extension
    expect(fileExtension('trailingdot.')).toBe('');
  });

  it('ignores surrounding whitespace', () => {
    expect(fileExtension('  resume.pdf  ')).toBe('pdf');
  });
});

describe('hasPdfStructure (doc 19 §5 — basic structural integrity)', () => {
  const validPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
    'latin1',
  );

  it('accepts a buffer with a %PDF- header and a %%EOF trailer', () => {
    expect(hasPdfStructure(validPdf)).toBe(true);
  });

  it('rejects a buffer missing the %PDF- header', () => {
    expect(hasPdfStructure(Buffer.from('not a pdf %%EOF'))).toBe(false);
  });

  it('rejects a truncated PDF with no %%EOF trailer', () => {
    const truncated = validPdf.subarray(0, validPdf.length - 8);
    expect(hasPdfStructure(truncated)).toBe(false);
  });

  it('rejects a too-short buffer', () => {
    expect(hasPdfStructure(Buffer.from('%PDF'))).toBe(false);
  });
});
