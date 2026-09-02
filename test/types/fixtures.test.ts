import { describe, expect, it } from "vitest";
import type { UniqueTopic } from "../../src/types/common";
import type {
  Absence,
  DelegateNamedVote,
  Interjection,
  InterestShare,
  PoliticalPosition,
  ReceivedInterjection,
  StanceTopicScore,
} from "../../src/types/delegate";
import type { FullSpeech } from "../../src/types/speech";
import type { MeilisearchHelper, Vote } from "../../src/types/voteResult";

/**
 * Payloads captured verbatim from the live API on 2026-09-02, annotated with
 * the wire types.
 *
 * The assertion here is the *compile*: if a type drifts from what the server
 * actually sends, these stop typechecking. The Rust sources and both frontends
 * describe an older shape for several of these, so the sources cannot be used
 * as the reference — production is.
 *
 * `satisfies` rather than `:` so excess properties are still rejected while the
 * literal keeps its narrow type.
 */

describe("live payload shapes", () => {
  it("Vote is per-member counts, not the old fraction/infavor pair", () => {
    // GET /api/at/v1/vote_results/latest?days=30 → [0].votes[0]
    const vote = {
      party: "FPÖ",
      code: null,
      infavor_count: 0,
      against_count: 57,
      abstention_count: 0,
      absence_count: 0,
    } satisfies Vote;

    // The dropped fields are derivable, so nothing is lost.
    const fraction =
      vote.infavor_count + vote.against_count + vote.abstention_count + vote.absence_count;
    expect(fraction).toBe(57);
    expect(vote.infavor_count > vote.against_count).toBe(false);
  });

  it("MeilisearchHelper rides along on every vote result", () => {
    const helper = { votes: [], issuer_parties: ["FPÖ"] } satisfies MeilisearchHelper;
    expect(helper.issuer_parties).toHaveLength(1);
  });

  it("PoliticalPosition wraps four named magnitudes and a per-topic breakdown", () => {
    // GET /api/at/v1/delegates/extend/30655?language=de → political_position
    const position = {
      total_score: {
        socialist: 0.3537190755208333,
        capitalist: 0.3838297526041667,
        liberal: 0.16141764322916666,
        authoritarian: 0.14603678385416666,
        count: 6,
      },
      scores_by_topic: [
        {
          topic: "Klima, Umwelt und Energie",
          topic_id: "-8291460274263416759",
          score: -0.011865234375,
          broken_down_score: {
            socialist: 0.47607421875,
            capitalist: 0.469482421875,
            liberal: 0.0,
            authoritarian: 0.0,
            count: 0,
          },
        },
      ],
    } satisfies PoliticalPosition;

    expect(position.scores_by_topic[0]?.topic_id).toBe("-8291460274263416759");
  });

  it("StanceTopicScore carries a topic id and a breakdown", () => {
    const score = {
      topic: "Parlament und Demokratie",
      topic_id: "-1616215530511931679",
      score: 0.09048834443092346,
      broken_down_score: {
        socialist: 0,
        capitalist: 0,
        liberal: 0,
        authoritarian: 0,
        count: 0,
      },
    } satisfies StanceTopicScore;

    expect(score.topic_id.startsWith("-")).toBe(true);
  });

  it("InterestShare carries a topic id", () => {
    const interest = {
      topic: "Budget und Finanzen",
      topic_id: "4836563141530063945",
      occurences: 71,
      total_share: 0.018427199,
      self_share: 0.42261904,
    } satisfies InterestShare;

    expect(interest.topic_id).toBe("4836563141530063945");
  });

  it("UniqueTopic ids are strings that exceed the safe integer range", () => {
    // GET /api/at/eurovoc_topics → [0]
    const topic = { topic: "Abfall", id: "6838196640260527284" } satisfies UniqueTopic;

    // Parsing it as a number would round-trip a different id to the server.
    expect(Number(topic.id) > Number.MAX_SAFE_INTEGER).toBe(true);
    expect(String(Number(topic.id))).not.toBe(topic.id);
  });

  it("FullSpeech exposes debate/delegate ids and received interjections", () => {
    // GET /api/at/v1/delegates/speeches_per_page → speeches[0], trimmed.
    const speech = {
      id: 1,
      debate_id: 46932946,
      delegate_id: 1567,
      speech: {
        delegate_id: 1567,
        vote_result_ids: [123831991, 100825272],
        infavor: false,
        duration_in_seconds: 433,
        opinion: "Contra",
        document_urls: ["https://www.parlament.gv.at/dokument/XXVIII/NRSITZ/66/A.html"],
        about: "Außen- und Europapolitischer Bericht 2024",
        start: "19:48:52",
      },
      ai_summary: null,
      relations: [],
      received_interjections: [
        {
          interjection_text: "Wir sind im Raumschiff Mir-san-mir!",
          interjector_delegate_id: 8242,
          plenar_speech_id: 615927125,
          rel_start_idx: 3522,
          rel_end_idx: 3644,
          delegate_matching_id: 11726505,
        },
      ],
    } satisfies FullSpeech;

    expect(speech.delegate_id).toBe(speech.speech.delegate_id);
  });

  it("ReceivedInterjection is narrower than a standalone Interjection", () => {
    // Nested in a speech: no speaker or date, and the match is just an id.
    const received = {
      interjection_text: "Das hat sie nicht gesagt!",
      interjector_delegate_id: 5687,
      plenar_speech_id: 618105948,
      rel_start_idx: 1114,
      rel_end_idx: 1159,
      delegate_matching_id: 11730708,
    } satisfies ReceivedInterjection;

    // GET /api/at/v1/delegates/interjections/made → interjections[0]
    const standalone = {
      interjection_text: "Das waren\nLinke!",
      interjector_delegate_id: 1567,
      date: "2020-01-21T23:00:00Z",
      speaker_delegate_id: 8178,
      plenar_speech_id: 615957889,
      rel_start_idx: 1646,
      rel_end_idx: 1724,
      delegate_match: {
        similiarity_score: 0,
        searched_with: "Fürst",
        matched_with: "Fürst Susanne, Dr.",
        delegate_id: 1567,
        manually_matched: false,
      },
    } satisfies Interjection;

    expect(received.delegate_matching_id).toBeTypeOf("number");
    expect(standalone.delegate_match.delegate_id).toBe(1567);
  });

  it("DelegateNamedVote dates are calendar dates, absences too", () => {
    const namedVote = {
      infavor: false,
      was_absent: false,
      legis_init_id: 131945333,
      named_vote_info_id: 194331,
      date: "2026-03-25",
    } satisfies DelegateNamedVote;

    const absence = {
      date: "2026-07-10",
      inr: 93,
      gp: "XXVIII",
      plenary_session_id: 9446566,
      missed_legis_init_ids: [],
      source_url: "https://www.parlament.gv.at/dokument/XXVIII/NRSITZ/93/A.html",
      council: "NR",
    } satisfies Absence;

    expect(namedVote.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(absence.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
