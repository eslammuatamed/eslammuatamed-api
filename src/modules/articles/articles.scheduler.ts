import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ArticlesService } from './articles.service';

// In-process cron (D07-3): promotes due SCHEDULED articles to PUBLISHED once per minute. Correct
// for a single API instance (doc 07 §5); horizontal scaling would move this to a locked job.
// @Cron handlers are auto-wrapped in try/catch by @nestjs/schedule, so a transient DB error is
// logged and retried next minute rather than crashing the process.
@Injectable()
export class ArticlesScheduler {
  private readonly logger = new Logger(ArticlesScheduler.name);

  constructor(private readonly articles: ArticlesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async promoteDueArticles(): Promise<void> {
    const promoted = await this.articles.promoteScheduled();
    if (promoted > 0) {
      this.logger.log(
        `Promoted ${promoted} scheduled article(s) to PUBLISHED.`,
      );
    }
  }
}
