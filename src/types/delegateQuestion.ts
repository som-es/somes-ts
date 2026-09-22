import type { IsoDate, IsoDateTime, Paginated, UniqueTopic } from "./common";

/** How a delegate question is delivered - directly to the delegate, or to their party. */
export type QuestionDelivery = "delegate" | "party";

export interface CreateDelegateQuestion {
  subject: string;
  body: string;
  eurovoc_topic_ids: string[];
}

export interface UpdateDelegateQuestion {
  subject?: string;
  body?: string;
  eurovoc_topic_ids?: string[];
}

export interface DelegateQuestionCreated {
  id: number;
  delivery: QuestionDelivery;
  recipient_name: string;
  /** Always `"pending"` on creation. */
  status: string;
  topics: UniqueTopic[];
}

export interface DelegateQuestionRecipient {
  delivery: QuestionDelivery;
  recipient_name: string;
}

export interface PublicDelegateQuestionAnswer {
  body: string;
  received_at: IsoDateTime;
}

export interface PublicDelegateQuestion {
  id: number;
  delegate_id: number;
  subject: string;
  body: string;
  created_at: IsoDateTime;
  created_at_date: IsoDate;
  topics: UniqueTopic[];
  answers: PublicDelegateQuestionAnswer[];
}

export interface DelegateQuestionsWithMaxPage extends Paginated {
  delegate_questions: PublicDelegateQuestion[];
  /** Unlike `PaginatedWithTimestamp`, this can be `null`. */
  updated_at: IsoDateTime | null;
}

/**
 * `status` and `recipient_kind` are raw strings server-side - the database
 * constrains them (`status` to `pending|sending|sent|failed|answered|rejected`,
 * `recipient_kind` to `delegate|party`), but the Rust struct doesn't, so they
 * stay untyped strings here rather than guessing at a closed union.
 */
export interface AdminDelegateQuestion {
  id: number;
  user_id: number;
  delegate_id: number;
  delegate_name: string;
  recipient_email: string;
  recipient_kind: string;
  recipient_name: string;
  subject: string;
  body: string;
  status: string;
  created_at: IsoDateTime;
  topics: UniqueTopic[];
}

/** Whether the question system is currently enabled server-side. */
export interface QuestionsStatus {
  enabled: boolean;
}
