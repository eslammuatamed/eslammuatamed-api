import { HEADERS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { AppConfigService } from '../../config/app-config.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { REQUIRE_PERMISSION_KEY } from '../access-control/decorators/require-permission.decorator';
import { ArticlesService } from '../articles/articles.service';
import { ProjectsService } from '../projects/projects.service';
import { PreviewAdminController } from './preview.admin.controller';
import { PreviewTokenService } from './preview-token.service';

const ARTICLE_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';

const config = {
  auth: { previewTokenSecret: 'test-preview-secret-value' },
} as AppConfigService;

describe('PreviewAdminController — mint (D10-11)', () => {
  let previewTokens: PreviewTokenService;
  let articles: DeepMockProxy<ArticlesService>;
  let projects: DeepMockProxy<ProjectsService>;
  let controller: PreviewAdminController;

  beforeEach(() => {
    previewTokens = new PreviewTokenService(config);
    articles = mockDeep<ArticlesService>();
    projects = mockDeep<ProjectsService>();
    // Existence checks resolve (entity present) by default; the not-found cases override.
    articles.getAdmin.mockResolvedValue({ id: ARTICLE_ID } as never);
    projects.getAdmin.mockResolvedValue({ id: PROJECT_ID } as never);
    controller = new PreviewAdminController(previewTokens, articles, projects);
  });

  describe('permission metadata (one permission per guarded function)', () => {
    const permissionOf = (method: keyof PreviewAdminController): unknown =>
      Reflect.getMetadata(
        REQUIRE_PERMISSION_KEY,
        PreviewAdminController.prototype[method],
      );

    it('requires articles.update to mint an article token', () => {
      expect(permissionOf('mintArticleToken')).toBe('articles.update');
    });

    it('requires projects.update to mint a project token', () => {
      expect(permissionOf('mintProjectToken')).toBe('projects.update');
    });

    it('neither mint route is @Public, so the default-deny JwtAuthGuard applies (401 without a token)', () => {
      for (const method of ['mintArticleToken', 'mintProjectToken'] as const) {
        expect(
          Reflect.getMetadata(
            IS_PUBLIC_KEY,
            PreviewAdminController.prototype[method],
          ),
        ).toBeUndefined();
      }
    });
  });

  describe('response shape + url (plural route segment, singular entityType)', () => {
    it('returns exactly {token,url,expiresAt}; url points at the public articles consume route', async () => {
      const result = await controller.mintArticleToken(ARTICLE_ID);

      expect(Object.keys(result).sort()).toEqual(['expiresAt', 'token', 'url']);
      expect(result.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      expect(result.url).toBe(
        `/api/v1/preview/articles/${ARTICLE_ID}?token=${result.token}`,
      );
      expect(result.expiresAt).toBeInstanceOf(Date);
      // The minted token verifies for the SINGULAR entityType the route binds — proving mint and
      // consume agree (a url pointing at articles/ backed by an 'article' MAC).
      expect(previewTokens.verify('article', ARTICLE_ID, result.token)).toBe(
        true,
      );
    });

    it('project mint uses the projects route segment and a project-typed MAC (cross-type safe)', async () => {
      const result = await controller.mintProjectToken(PROJECT_ID);

      expect(result.url).toBe(
        `/api/v1/preview/projects/${PROJECT_ID}?token=${result.token}`,
      );
      expect(previewTokens.verify('project', PROJECT_ID, result.token)).toBe(
        true,
      );
      // A project token must NOT verify as an article, even for the same id.
      expect(previewTokens.verify('article', PROJECT_ID, result.token)).toBe(
        false,
      );
    });
  });

  describe('existence check (admin 404 convention, no token for a ghost entity)', () => {
    it('propagates NotFound when the article does not exist', async () => {
      articles.getAdmin.mockRejectedValue(
        new NotFoundException('Article not found.'),
      );

      await expect(
        controller.mintArticleToken(ARTICLE_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates NotFound when the project does not exist', async () => {
      projects.getAdmin.mockRejectedValue(
        new NotFoundException('Project not found.'),
      );

      await expect(
        controller.mintProjectToken(PROJECT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('route metadata: 200 (not 201) + no-store', () => {
    it('forces HTTP 200 and Cache-Control: no-store on both mint routes', () => {
      for (const handler of [
        PreviewAdminController.prototype.mintArticleToken,
        PreviewAdminController.prototype.mintProjectToken,
      ]) {
        expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(
          HttpStatus.OK,
        );
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
