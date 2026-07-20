import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ContactMessage } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ContactThrottlerGuard } from '../../common/throttling/contact-throttler.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRE_PERMISSION_KEY } from '../access-control/decorators/require-permission.decorator';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { MessagesAdminController } from './messages.admin.controller';

const persisted: ContactMessage = {
  id: 'msg-1',
  name: 'Alex',
  email: 'alex@example.com',
  subject: 'Hi',
  body: 'Hello there, this is a genuine message.',
  isRead: false,
  isArchived: false,
  archivedAt: null,
  meta: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validDto = {
  name: 'Alex',
  email: 'alex@example.com',
  subject: 'Hi',
  body: 'Hello there, this is a genuine message.',
};

describe('ContactController — intake receipt', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let controller: ContactController;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    prisma.contactMessage.create.mockResolvedValue(persisted);
    controller = new ContactController(new ContactService(prisma));
  });

  it('returns an identical receipt for a persisted and a silently-dropped submission', async () => {
    const persistedReceipt = await controller.submit(
      { ...validDto, elapsedMs: 9000 },
      'Mozilla/5.0',
      'https://example.com',
    );
    const droppedReceipt = await controller.submit(
      { ...validDto, website: 'http://bot.example', elapsedMs: 9000 },
      'Mozilla/5.0',
      'https://example.com',
    );

    // Byte-identical body, and nothing in it distinguishes the two cases (no id, no status flag).
    expect(persistedReceipt).toEqual({ received: true });
    expect(droppedReceipt).toEqual(persistedReceipt);

    // The persisted path wrote once; the dropped path wrote nothing.
    expect(prisma.contactMessage.create).toHaveBeenCalledTimes(1);
  });
});

describe('ContactController — route metadata', () => {
  it('POST /contact is @Public and guarded by ContactThrottlerGuard', () => {
    const handler = ContactController.prototype.submit;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);

    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    expect(guards).toContain(ContactThrottlerGuard);
  });
});

describe('MessagesAdminController — permission metadata', () => {
  const permissionOf = (method: keyof MessagesAdminController): unknown =>
    Reflect.getMetadata(
      REQUIRE_PERMISSION_KEY,
      MessagesAdminController.prototype[method],
    );

  it('declares messages.read on the reads and messages.update on the mutation', () => {
    expect(permissionOf('list')).toBe('messages.read');
    expect(permissionOf('get')).toBe('messages.read');
    expect(permissionOf('update')).toBe('messages.update');
  });

  it('never uses a messages.create key (there is no create route)', () => {
    const declared = (['list', 'get', 'update'] as const).map(permissionOf);

    expect(declared).not.toContain('messages.create');
    expect(new Set(declared)).toEqual(
      new Set(['messages.read', 'messages.update']),
    );
  });
});
