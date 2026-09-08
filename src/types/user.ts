/** The canonical user record from `GET /v1/user/`. */
export interface ExtendedUserInfo {
  id: number;
  email: string;
  is_email_hashed: boolean;
  is_admin: boolean;
}

export interface MailSendInfo {
  send_new_vote_results_mails: boolean;
  send_new_vote_result_by_favo_mails: boolean;
  send_new_delegate_activity_mails: boolean;
  send_new_ministrial_prop_mails: boolean;
  send_new_ministrial_prop_by_favo_mails: boolean;
  send_new_decree_mails: boolean;
  send_new_decree_by_favo_mails: boolean;
  send_new_proposal_mails: boolean;
  send_new_proposal_by_favo_mails: boolean;
}

/** A bookmarked delegate, plus how many days of activity to be notified about. */
export interface DelegateFavo {
  delegate_id: number;
  user_info_days: number;
}

export interface LegisInitFavo {
  vote_result_id: number;
}

/**
 * Returned by the email-management endpoints. When the change completes, a
 * freshly signed token is handed back and must replace the stored one, because
 * the email lives in the JWT's `sub` claim.
 */
export interface ChangeMailResponse {
  success: boolean;
  message: string;
  requires_otp: boolean;
  access_token: string | null;
}

export type AnonymizeEmailResponse = ChangeMailResponse;

export type PushPlatform = "ios" | "android" | "web";

export interface PushTokenInfo {
  push_token: string;
  platform: PushPlatform;
  enabled: boolean;
}

export interface NotificationSettings {
  platform: PushPlatform;
  send_new_vote_results: boolean;
  send_new_vote_result_by_favo: boolean;
  send_new_delegate_activity: boolean;
  send_new_ministrial_prop: boolean;
  send_new_ministrial_prop_by_favo: boolean;
  send_new_decree: boolean;
  send_new_decree_by_favo: boolean;
  send_new_proposal: boolean;
  send_new_proposal_by_favo: boolean;
}
