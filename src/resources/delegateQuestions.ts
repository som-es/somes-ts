import { delegateQuestionsPath } from "../http/routes";
import type {
  AdminDelegateQuestion,
  CreateDelegateQuestion,
  DelegateQuestionCreated,
  DelegateQuestionRecipient,
  DelegateQuestionsWithMaxPage,
  PublicDelegateQuestion,
  UpdateDelegateQuestion,
} from "../types/delegateQuestion";
import { Resource } from "./base";

export interface DelegateQuestionSearchOptions {
  page: number;
  entriesPerPage: number;
  /** Free-text search over subject/body. */
  search?: string;
  sort?: "Asc" | "Desc";
  /** `YYYY-MM-DD`, inclusive, filtered on `created_at_date`. */
  dateFrom?: string;
  /** `YYYY-MM-DD`, inclusive, filtered on `created_at_date`. */
  dateTo?: string;
  /** Eurovoc topic ids; matches questions carrying any of them. */
  topicIds?: readonly string[];
}

/**
 * Asking a delegate a question, admin review/approve/reject, and the public
 * Q&A archive. See `delegateQuestionsPath` for why these currently 404.
 */
export class DelegateQuestionsResource extends Resource {
  all(language = "de"): Promise<PublicDelegateQuestion[]> {
    return this.http.get<PublicDelegateQuestion[]>(delegateQuestionsPath(this.country, ""), {
      query: { language },
    });
  }

  byDelegate(delegateId: number, language = "de"): Promise<PublicDelegateQuestion[]> {
    return this.http.get<PublicDelegateQuestion[]>(
      delegateQuestionsPath(this.country, `/delegate/${delegateId}`),
      { query: { language } },
    );
  }

  byId(questionId: number, language = "de"): Promise<PublicDelegateQuestion> {
    return this.http.get<PublicDelegateQuestion>(
      delegateQuestionsPath(this.country, `/${questionId}`),
      { query: { language } },
    );
  }

  recipient(delegateId: number): Promise<DelegateQuestionRecipient> {
    return this.http.get<DelegateQuestionRecipient>(
      delegateQuestionsPath(this.country, `/delegate/${delegateId}/question_recipient`),
    );
  }

  search(options: DelegateQuestionSearchOptions): Promise<DelegateQuestionsWithMaxPage> {
    const { page, entriesPerPage, search, sort, dateFrom, dateTo, topicIds = [] } = options;

    const query: Record<string, string | number> = {
      page,
      entries_per_page: entriesPerPage,
    };

    if (search) {
      query.search = search;
    }
    if (sort) {
      query.sort = sort;
    }
    if (dateFrom) {
      query.date_from = dateFrom;
    }
    if (dateTo) {
      query.date_to = dateTo;
    }

    topicIds.forEach((id, index) => {
      query[`filter_topics[${index}]`] = id;
    });

    return this.http.get<DelegateQuestionsWithMaxPage>(
      delegateQuestionsPath(this.country, "/search"),
      { query },
    );
  }

  /**
   * `async` so `this.token()` throwing on a missing token surfaces as a
   * rejected promise rather than a synchronous throw, matching every other
   * authenticated method in this library (see `account.ts`).
   */
  async ask(
    delegateId: number,
    question: CreateDelegateQuestion,
    language = "de",
  ): Promise<DelegateQuestionCreated> {
    return this.http.post<DelegateQuestionCreated>(
      delegateQuestionsPath(this.country, `/delegate/${delegateId}`),
      question,
      { token: this.token(), query: { language } },
    );
  }

  async pending(language = "de"): Promise<AdminDelegateQuestion[]> {
    return this.http.get<AdminDelegateQuestion[]>(delegateQuestionsPath(this.country, "/pending"), {
      token: this.token(),
      query: { language },
    });
  }

  async approve(questionId: number, language = "de"): Promise<AdminDelegateQuestion> {
    return this.http.post<AdminDelegateQuestion>(
      delegateQuestionsPath(this.country, `/${questionId}/approve`),
      undefined,
      { token: this.token(), query: { language } },
    );
  }

  async reject(questionId: number, language = "de"): Promise<AdminDelegateQuestion> {
    return this.http.post<AdminDelegateQuestion>(
      delegateQuestionsPath(this.country, `/${questionId}/reject`),
      undefined,
      { token: this.token(), query: { language } },
    );
  }

  async update(
    questionId: number,
    update: UpdateDelegateQuestion,
    language = "de",
  ): Promise<AdminDelegateQuestion> {
    return this.http.patch<AdminDelegateQuestion>(
      delegateQuestionsPath(this.country, `/${questionId}`),
      update,
      { token: this.token(), query: { language } },
    );
  }
}
