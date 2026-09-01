import { bookmarkPath, userPath } from "../http/routes";
import type { UniqueTopic } from "../types/common";
import type {
  AnonymizeEmailResponse,
  ChangeMailResponse,
  DelegateFavo,
  ExtendedUserInfo,
  LegisInitFavo,
  MailSendInfo,
} from "../types/user";
import { Resource } from "./base";

/**
 * The signed-in user's own account: profile, notification preferences,
 * bookmarks, topic selection and email management. Every call requires a token.
 */
export class AccountResource extends Resource {
  /** The canonical user record. Note the JWT's claims are not kept in sync with this. */
  async me(): Promise<ExtendedUserInfo> {
    return this.http.get<ExtendedUserInfo>(userPath(this.country, "/"), { token: this.token() });
  }

  /** Irreversible. The stored token is cleared on success. */
  async deleteAccount(): Promise<void> {
    await this.http.delete(userPath(this.country, "/delete"), undefined, {
      token: this.token(),
    });
  }

  async topics(): Promise<UniqueTopic[]> {
    return this.http.get<UniqueTopic[]>(userPath(this.country, "/topic_selection"), {
      token: this.token(),
    });
  }

  async addTopic(topic: UniqueTopic): Promise<void> {
    await this.http.post(userPath(this.country, "/topic_selection"), topic, {
      token: this.token(),
    });
  }

  async removeTopic(topic: UniqueTopic): Promise<void> {
    await this.http.delete(userPath(this.country, "/topic_selection"), topic, {
      token: this.token(),
    });
  }

  async mailSendInfo(): Promise<MailSendInfo> {
    return this.http.get<MailSendInfo>(userPath(this.country, "/send_mail_info"), {
      token: this.token(),
    });
  }

  async updateMailSendInfo(info: MailSendInfo): Promise<void> {
    await this.http.put(userPath(this.country, "/send_mail_info"), info, {
      token: this.token(),
    });
  }

  async bookmarkedDelegates(): Promise<DelegateFavo[]> {
    return this.http.get<DelegateFavo[]>(bookmarkPath(this.country, "/delegate"), {
      token: this.token(),
    });
  }

  async addDelegateBookmark(bookmark: DelegateFavo): Promise<void> {
    await this.http.post(bookmarkPath(this.country, "/delegate"), bookmark, {
      token: this.token(),
    });
  }

  async updateDelegateBookmark(bookmark: DelegateFavo): Promise<void> {
    await this.http.put(bookmarkPath(this.country, "/delegate"), bookmark, {
      token: this.token(),
    });
  }

  async removeDelegateBookmark(bookmark: DelegateFavo): Promise<void> {
    await this.http.delete(bookmarkPath(this.country, "/delegate"), bookmark, {
      token: this.token(),
    });
  }

  async bookmarkedVoteResults(): Promise<LegisInitFavo[]> {
    return this.http.get<LegisInitFavo[]>(bookmarkPath(this.country, "/vote_result"), {
      token: this.token(),
    });
  }

  async addVoteResultBookmark(bookmark: LegisInitFavo): Promise<void> {
    await this.http.post(bookmarkPath(this.country, "/vote_result"), bookmark, {
      token: this.token(),
    });
  }

  async removeVoteResultBookmark(bookmark: LegisInitFavo): Promise<void> {
    await this.http.delete(bookmarkPath(this.country, "/vote_result"), bookmark, {
      token: this.token(),
    });
  }

  /** Step 1 of an email change: sends an OTP to the new address. */
  changeEmail(newEmail: string): Promise<ChangeMailResponse> {
    return this.rotatingPost("/change_email", { new_email: newEmail });
  }

  /** Step 2: confirms the new address with the emailed OTP. */
  verifyEmailChange(newEmail: string, otp: string): Promise<ChangeMailResponse> {
    return this.rotatingPost("/verify_email_change", { new_email: newEmail, otp });
  }

  /** Replaces the stored address with a hash of it, or restores it. */
  anonymizeEmail(anonymize: boolean, email?: string): Promise<AnonymizeEmailResponse> {
    return this.rotatingPost("/anonymize_email", { anonymize, email: email ?? null });
  }

  /**
   * These endpoints hand back a freshly signed token whenever they change the
   * email, because it is carried in the JWT's `sub` claim. Persisting it here
   * keeps the caller from having to remember to do so.
   */
  private async rotatingPost(path: string, body: unknown): Promise<ChangeMailResponse> {
    const response = await this.http.post<ChangeMailResponse>(userPath(this.country, path), body, {
      token: this.token(),
    });
    if (response.access_token) {
      await this.setToken(response.access_token);
    }
    return response;
  }
}
