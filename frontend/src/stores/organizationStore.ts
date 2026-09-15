import { create } from 'zustand';
import {
  createOrganization,
  fetchMyMemberships,
  fetchOrganizationActivities,
  fetchOrganizationInvites,
  fetchOrganizationMembers,
  fetchOrganizationSummary,
  issueOrganizationInvite,
  leaveOrganization,
  OrganizationPayload,
  redeemInvite,
  removeOrganizationMember
} from '../api/organization';
import { OrganizationActivityRow, OrganizationInvite, OrganizationMembership, OrganizationSummary } from '../types/entities';

interface OrganizationStore {
  memberships: OrganizationMembership[];
  summary: OrganizationSummary | null;
  members: OrganizationMembership[];
  invites: OrganizationInvite[];
  feed: OrganizationActivityRow[];
  month?: string;
  loading: boolean;
  loadMine: () => Promise<void>;
  loadSummary: (orgId: number, month?: string) => Promise<void>;
  loadMembers: (orgId: number) => Promise<void>;
  loadInvites: (orgId: number) => Promise<void>;
  loadFeed: (orgId: number, month?: string) => Promise<void>;
  create: (payload: OrganizationPayload) => Promise<void>;
  redeem: (code: string) => Promise<void>;
  leave: (orgId: number) => Promise<void>;
  issueInvite: (orgId: number) => Promise<void>;
  removeMember: (orgId: number, userId: number) => Promise<void>;
}

export const useOrganizationStore = create<OrganizationStore>((set, get) => ({
  memberships: [],
  summary: null,
  members: [],
  invites: [],
  feed: [],
  month: undefined,
  loading: false,
  async loadMine() {
    set({ loading: true });
    const memberships = await fetchMyMemberships();
    set({ memberships, loading: false });
  },
  async loadSummary(orgId, month) {
    const summary = await fetchOrganizationSummary(orgId, month);
    set({ summary, month: summary.month });
  },
  async loadMembers(orgId) {
    const members = await fetchOrganizationMembers(orgId);
    set({ members });
  },
  async loadInvites(orgId) {
    const invites = await fetchOrganizationInvites(orgId);
    set({ invites });
  },
  async loadFeed(orgId, month) {
    const feed = await fetchOrganizationActivities(orgId, month);
    set({ feed });
  },
  async create(payload) {
    await createOrganization(payload);
    await get().loadMine();
  },
  async redeem(code) {
    await redeemInvite(code);
    await get().loadMine();
  },
  async leave(orgId) {
    await leaveOrganization(orgId);
    set({ summary: null, members: [], invites: [], feed: [] });
    await get().loadMine();
  },
  async issueInvite(orgId) {
    await issueOrganizationInvite(orgId);
    await get().loadInvites(orgId);
  },
  async removeMember(orgId, userId) {
    await removeOrganizationMember(orgId, userId);
  }
}));
