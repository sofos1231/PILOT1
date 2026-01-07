import { create } from 'zustand';
import { Club, ClubMembership, ClubWithMembership, ClubTable } from '../types/club.types';
import { clubsApi, CreateClubData } from '../services/api/clubsApi';

interface ClubState {
  // User's clubs
  myClubs: ClubWithMembership[];
  myClubsLoading: boolean;

  // Club discovery
  discoveredClubs: Club[];
  discoveredClubsTotal: number;
  discoveryLoading: boolean;

  // Current club (for lobby view)
  currentClub: Club | null;
  currentMembership: ClubMembership | null;
  currentMembers: ClubMembership[];
  currentTables: ClubTable[];
  currentClubLoading: boolean;

  // Actions
  fetchMyClubs: () => Promise<void>;
  searchClubs: (search?: string) => Promise<void>;
  fetchClubDetails: (clubId: string) => Promise<void>;
  fetchMembers: (clubId: string) => Promise<void>;
  fetchTables: (clubId: string) => Promise<void>;
  createClub: (data: CreateClubData) => Promise<Club>;
  joinClub: (clubId: string) => Promise<void>;
  leaveClub: (clubId: string) => Promise<void>;
  setCurrentClub: (club: Club | null) => void;
  clearCurrentClub: () => void;
}

export const useClubStore = create<ClubState>((set, get) => ({
  myClubs: [],
  myClubsLoading: false,
  discoveredClubs: [],
  discoveredClubsTotal: 0,
  discoveryLoading: false,
  currentClub: null,
  currentMembership: null,
  currentMembers: [],
  currentTables: [],
  currentClubLoading: false,

  fetchMyClubs: async () => {
    set({ myClubsLoading: true });
    try {
      const { data } = await clubsApi.getMyClubs();
      set({ myClubs: data.clubs, myClubsLoading: false });
    } catch (error) {
      set({ myClubsLoading: false });
      throw error;
    }
  },

  searchClubs: async (search?: string) => {
    set({ discoveryLoading: true });
    try {
      const { data } = await clubsApi.searchClubs({ search, limit: 20 });
      set({
        discoveredClubs: data.clubs,
        discoveredClubsTotal: data.total,
        discoveryLoading: false,
      });
    } catch (error) {
      set({ discoveryLoading: false });
      throw error;
    }
  },

  fetchClubDetails: async (clubId: string) => {
    set({ currentClubLoading: true });
    try {
      const { data } = await clubsApi.getClub(clubId);
      set({
        currentClub: data.club,
        currentMembership: data.membership,
        currentClubLoading: false,
      });
    } catch (error) {
      set({ currentClubLoading: false });
      throw error;
    }
  },

  fetchMembers: async (clubId: string) => {
    try {
      const { data } = await clubsApi.getMembers(clubId, { limit: 50 });
      set({ currentMembers: data.members });
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  },

  fetchTables: async (clubId: string) => {
    try {
      const { data } = await clubsApi.getTables(clubId);
      set({ currentTables: data.tables });
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    }
  },

  createClub: async (data: CreateClubData) => {
    const { data: result } = await clubsApi.createClub(data);
    // Refresh my clubs list
    await get().fetchMyClubs();
    return result.club;
  },

  joinClub: async (clubId: string) => {
    await clubsApi.joinClub(clubId);
    // Refresh data
    await Promise.all([
      get().fetchMyClubs(),
      get().fetchClubDetails(clubId),
    ]);
  },

  leaveClub: async (clubId: string) => {
    await clubsApi.leaveClub(clubId);
    await get().fetchMyClubs();
    set({ currentMembership: null });
  },

  setCurrentClub: (club: Club | null) => {
    set({ currentClub: club });
  },

  clearCurrentClub: () => {
    set({
      currentClub: null,
      currentMembership: null,
      currentMembers: [],
      currentTables: [],
    });
  },
}));
