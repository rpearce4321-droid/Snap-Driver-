import { json, requireDb } from "../_db";

type Row = Record<string, any>;

function parseJson(raw: any) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function withSeedMeta(item: any, row: Row) {
  return {
    ...item,
    __seed: row.is_seed === 1,
    seedBatchId: row.seed_batch_id ?? undefined,
  };
}

function mergeRow(row: Row, overrides: Record<string, any>) {
  const extra = parseJson(row.data_json);
  const base = { ...extra, ...overrides };
  return withSeedMeta(base, row);
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  const db = requireDb(env as any);

  const seekersRows = await db
    .prepare("SELECT id, status, first_name, last_name, company_name, data_json, is_seed, seed_batch_id, created_at, updated_at FROM seekers")
    .all<Row>();
  const seekers = seekersRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      role: "SEEKER",
      status: row.status,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      companyName: row.company_name ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })
  );

  const retainersRows = await db
    .prepare("SELECT id, status, company_name, ceo_name, payment_terms, pay_cycle_close_day, pay_cycle_frequency, pay_cycle_timezone, data_json, is_seed, seed_batch_id, created_at, updated_at FROM retainers")
    .all<Row>();
  const retainers = retainersRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      role: "RETAINER",
      status: row.status,
      companyName: row.company_name ?? undefined,
      ceoName: row.ceo_name ?? undefined,
      paymentTerms: row.payment_terms ?? undefined,
      payCycleCloseDay: row.pay_cycle_close_day ?? undefined,
      payCycleFrequency: row.pay_cycle_frequency ?? undefined,
      payCycleTimezone: row.pay_cycle_timezone ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })
  );

  const retainerUsersRows = await db
    .prepare("SELECT id, retainer_id, first_name, last_name, title, email, phone, photo_url, bio, level, data_json, is_seed, seed_batch_id, created_at FROM retainer_users")
    .all<Row>();
  const retainerUsers = retainerUsersRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      retainerId: row.retainer_id,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      title: row.title ?? undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      photoUrl: row.photo_url ?? undefined,
      bio: row.bio ?? undefined,
      level: row.level ?? undefined,
      createdAt: row.created_at ?? undefined,
    })
  );

  const subcontractorRows = await db
    .prepare("SELECT id, seeker_id, first_name, last_name, title, email, phone, photo_url, bio, data_json, is_seed, seed_batch_id, created_at FROM subcontractors")
    .all<Row>();
  const subcontractors = subcontractorRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      seekerId: row.seeker_id,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      title: row.title ?? undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      photoUrl: row.photo_url ?? undefined,
      bio: row.bio ?? undefined,
      createdAt: row.created_at ?? undefined,
    })
  );

  const linksRows = await db
    .prepare("SELECT id, retainer_id, seeker_id, status, data_json, is_seed, seed_batch_id, created_at, updated_at FROM links")
    .all<Row>();
  const links = linksRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      retainerId: row.retainer_id,
      seekerId: row.seeker_id,
      status: row.status,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })
  );

  const conversationsRows = await db
    .prepare("SELECT id, retainer_id, seeker_id, data_json, is_seed, seed_batch_id, created_at, updated_at FROM conversations")
    .all<Row>();
  const conversations = conversationsRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      retainerId: row.retainer_id,
      seekerId: row.seeker_id,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })
  );

  const messagesRows = await db
    .prepare("SELECT id, conversation_id, sender_role, sender_id, body, data_json, is_seed, seed_batch_id, created_at FROM messages")
    .all<Row>();
  const messages = messagesRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      conversationId: row.conversation_id,
      senderRole: row.sender_role,
      senderId: row.sender_id,
      body: row.body,
      createdAt: row.created_at ?? undefined,
    })
  );

  const routesRows = await db
    .prepare("SELECT id, retainer_id, status, title, data_json, is_seed, seed_batch_id, created_at, updated_at FROM routes")
    .all<Row>();
  const routes = routesRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      retainerId: row.retainer_id,
      status: row.status,
      title: row.title ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })
  );

  const routeInterestsRows = await db
    .prepare("SELECT id, route_id, seeker_id, status, data_json, is_seed, seed_batch_id, created_at FROM route_interests")
    .all<Row>();
  const routeInterests = routeInterestsRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      routeId: row.route_id,
      seekerId: row.seeker_id,
      status: row.status,
      createdAt: row.created_at ?? undefined,
    })
  );

  const postsRows = await db
    .prepare("SELECT id, retainer_id, type, status, data_json, is_seed, seed_batch_id, created_at, updated_at FROM posts")
    .all<Row>();
  const posts = postsRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      retainerId: row.retainer_id,
      type: row.type,
      status: row.status,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })
  );

  const broadcastsRows = await db
    .prepare("SELECT id, retainer_id, status, data_json, is_seed, seed_batch_id, created_at, updated_at FROM broadcasts")
    .all<Row>();
  const broadcasts = broadcastsRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      retainerId: row.retainer_id,
      status: row.status,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })
  );

  const badgeDefsRows = await db
    .prepare("SELECT id, role, title, icon_key, data_json, is_seed, seed_batch_id, created_at, updated_at FROM badge_definitions")
    .all<Row>();
  const badgeDefinitions = badgeDefsRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      ownerRole: row.role,
      role: row.role,
      title: row.title,
      iconKey: row.icon_key ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })
  );

  const badgeSelectionsRows = await db
    .prepare("SELECT id, owner_role, owner_id, badge_id, kind, is_active, locked_until, data_json, is_seed, seed_batch_id, created_at, updated_at FROM badge_selections")
    .all<Row>();
  const badgeSelections = badgeSelectionsRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      ownerRole: row.owner_role,
      ownerId: row.owner_id,
      badgeId: row.badge_id,
      kind: row.kind,
      isActive: row.is_active === 1,
      lockedUntil: row.locked_until ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })
  );

  const badgeCheckinsRows = await db
    .prepare("SELECT id, badge_id, owner_role, owner_id, target_role, target_id, value, status, data_json, is_seed, seed_batch_id, created_at FROM badge_checkins")
    .all<Row>();
  const badgeCheckins = badgeCheckinsRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      badgeId: row.badge_id,
      ownerRole: row.owner_role,
      ownerId: row.owner_id,
      targetRole: row.target_role,
      targetId: row.target_id,
      value: row.value,
      status: row.status,
      createdAt: row.created_at ?? undefined,
    })
  );

  const reputationRows = await db
    .prepare("SELECT id, owner_role, owner_id, score, score_percent, note, data_json, is_seed, seed_batch_id, created_at FROM reputation_scores")
    .all<Row>();
  const reputationScores = reputationRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      ownerRole: row.owner_role,
      ownerId: row.owner_id,
      score: row.score,
      scorePercent: row.score_percent,
      note: row.note ?? undefined,
      createdAt: row.created_at ?? undefined,
    })
  );

  const recordRows = await db
    .prepare("SELECT id, owner_role, owner_id, badge_id, value, delta, data_json, is_seed, seed_batch_id, created_at FROM record_hall_entries")
    .all<Row>();
  const recordHallEntries = recordRows.results.map((row) =>
    mergeRow(row, {
      id: row.id,
      ownerRole: row.owner_role,
      ownerId: row.owner_id,
      badgeId: row.badge_id ?? undefined,
      value: row.value ?? undefined,
      delta: row.delta ?? undefined,
      createdAt: row.created_at ?? undefined,
    })
  );

  const settingsRows = await db
    .prepare("SELECT key, value, updated_at FROM system_settings")
    .all<Row>();
  const systemSettings = settingsRows.results.map((row) => ({
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at,
  }));
  return json({
    seekers,
    retainers,
    retainerUsers,
    subcontractors,
    links,
    conversations,
    messages,
    routes,
    routeInterests,
    posts,
    broadcasts,
    badgeDefinitions,
    badgeSelections,
    badgeCheckins,
    reputationScores,
    recordHallEntries,
    systemSettings,
  });
};


