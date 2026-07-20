import { HEADERS_METADATA } from '@nestjs/common/constants';
import { NotFoundException } from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { AppConfigService } from '../../config/app-config.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ArticlesService } from '../articles/articles.service';
import { PublicArticleDetailEntity } from '../articles/entities/article.entities';
import { ProjectsService } from '../projects/projects.service';
import { PublicProjectDetailEntity } from '../projects/entities/project.entities';
import { PreviewController } from './preview.controller';
import { PreviewTokenService } from './preview-token.service';

// A well-formed UUID keeps the (bypassed-in-unit) ParseUUIDPipe irrelevant, so every 404 below comes
// from the TOKEN path, not a malformed-id 400 (the distinction the advisor flagged).
const ARTICLE_ID = '2f1c8d9e-4a3b-4c5d-8e6f-7a8b9c0d1e2f';
const PROJECT_ID = '3a2b1c0d-5e4f-4a3b-9c8d-1e2f3a4b5c6d';

// Only auth.previewTokenSecret is read, so a plain typed stub suffices (same pattern as
// preview-token.service.spec.ts). The real PreviewTokenService exercises the genuine HMAC verify
// path — so garbage/expired/tampered/cross-type all flow through the actual trust boundary.
const config = {
  auth: { previewTokenSecret: 'test-preview-secret-value' },
} as AppConfigService;

const articleDraft = {
  id: ARTICLE_ID,
  title: 'Draft title',
  slug: 'draft-slug',
} as unknown as PublicArticleDetailEntity;

const projectDraft = {
  id: PROJECT_ID,
  title: 'Unpublished project',
  slug: 'unpublished-project',
} as unknown as PublicProjectDetailEntity;

describe('PreviewController — consume (D10-8, draft invisibility)', () => {
  let previewTokens: PreviewTokenService;
  let articles: DeepMockProxy<ArticlesService>;
  let projects: DeepMockProxy<ProjectsService>;
  let controller: PreviewController;

  beforeEach(() => {
    previewTokens = new PreviewTokenService(config);
    articles = mockDeep<ArticlesService>();
    projects = mockDeep<ProjectsService>();
    articles.getPreviewById.mockResolvedValue(articleDraft);
    projects.getPreviewById.mockResolvedValue(projectDraft);
    controller = new PreviewController(previewTokens, articles, projects);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('valid token returns the draft', () => {
    it('returns the unpublished article and delegates to getPreviewById(id, locale)', async () => {
      const { token } = previewTokens.mint('article', ARTICLE_ID);

      const result = await controller.previewArticle(ARTICLE_ID, {
        token,
        locale: 'ar',
      });

      expect(result).toBe(articleDraft);
      expect(articles.getPreviewById).toHaveBeenCalledWith(ARTICLE_ID, 'ar');
    });

    it('returns the unpublished project on a valid project token', async () => {
      const { token } = previewTokens.mint('project', PROJECT_ID);

      const result = await controller.previewProject(PROJECT_ID, {
        token,
        locale: 'en',
      });

      expect(result).toBe(projectDraft);
      expect(projects.getPreviewById).toHaveBeenCalledWith(PROJECT_ID, 'en');
    });
  });

  describe('bad tokens 404 (never 401/403, never 500) and never touch the entity', () => {
    it('404s an absent token and never calls getPreviewById', async () => {
      await expect(
        controller.previewArticle(ARTICLE_ID, { locale: 'en' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(articles.getPreviewById).not.toHaveBeenCalled();
    });

    it('404s a garbage (non-token) string without throwing anything but NotFound', async () => {
      await expect(
        controller.previewArticle(ARTICLE_ID, {
          token: '!!!not-a-token',
          locale: 'en',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(articles.getPreviewById).not.toHaveBeenCalled();
    });

    it('404s an expired token (30-min TTL elapsed)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-20T12:00:00.000Z'));
      const { token } = previewTokens.mint('article', ARTICLE_ID);
      jest.setSystemTime(new Date('2026-07-20T12:31:00.000Z'));

      await expect(
        controller.previewArticle(ARTICLE_ID, { token, locale: 'en' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(articles.getPreviewById).not.toHaveBeenCalled();
    });

    it('404s a tampered MAC', async () => {
      const { token } = previewTokens.mint('article', ARTICLE_ID);
      const dotIndex = token.indexOf('.');
      const expPart = token.slice(0, dotIndex);
      const macPart = token.slice(dotIndex + 1);
      const flipped = (macPart.startsWith('A') ? 'B' : 'A') + macPart.slice(1);

      await expect(
        controller.previewArticle(ARTICLE_ID, {
          token: `${expPart}.${flipped}`,
          locale: 'en',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s a token minted for a different id', async () => {
      const { token } = previewTokens.mint('article', 'some-other-article-id');

      await expect(
        controller.previewArticle(ARTICLE_ID, { token, locale: 'en' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cross-type token 404 (the MAC binds entityType)', () => {
    it('404s an ARTICLE token presented on the projects route', async () => {
      // Same id, article token — must not unlock the project preview.
      const { token } = previewTokens.mint('article', PROJECT_ID);

      await expect(
        controller.previewProject(PROJECT_ID, { token, locale: 'en' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(projects.getPreviewById).not.toHaveBeenCalled();
    });

    it('404s a PROJECT token presented on the articles route', async () => {
      const { token } = previewTokens.mint('project', ARTICLE_ID);

      await expect(
        controller.previewArticle(ARTICLE_ID, { token, locale: 'en' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(articles.getPreviewById).not.toHaveBeenCalled();
    });
  });

  describe('route metadata', () => {
    it('both consume routes are @Public and set Cache-Control: no-store', () => {
      for (const handler of [
        PreviewController.prototype.previewArticle,
        PreviewController.prototype.previewProject,
      ]) {
        expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
        const headers = Reflect.getMetadata(HEADERS_METADATA, handler) as {
          name: string;
          value: string;
        }[];
        expect(headers).toContainEqual({
          name: 'Cache-Control',
          value: 'no-store',
        });
      }
    });
  });
});
