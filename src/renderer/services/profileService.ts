// src/renderer/services/profileService.ts
// Este servicio gestionará la lógica de perfiles (premium y no-premium)

export interface Profile {
  id: string;
  username: string;
  type: 'microsoft' | 'non-premium';
  lastUsed: number;
  skinUrl?: string; // URL de la skin personalizada
}

const STORAGE_KEY = 'launcher_profiles';
const CURRENT_USER_KEY = 'launcher_current_user';

function getProfiles(): Profile[] {
  const profilesJson = localStorage.getItem(STORAGE_KEY);
  return profilesJson ? JSON.parse(profilesJson) : [];
}

function saveProfiles(profiles: Profile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export const profileService = {
  getAllProfiles(): Profile[] {
    return getProfiles();
  },

  getProfileByUsername(username: string): Profile | undefined {
    return getProfiles().find(p => p.username === username);
  },

  addProfile(username: string, type: 'microsoft' | 'non-premium'): Profile {
    const profiles = getProfiles();
    if (profiles.some(p => p.username === username)) {
      // Si el perfil ya existe, actualizar su tipo y última vez usado
      const updatedProfiles = profiles.map(p =>
        p.username === username ? { ...p, type, lastUsed: Date.now() } : p
      );
      saveProfiles(updatedProfiles);
      this.setCurrentProfile(username);
      return updatedProfiles.find(p => p.username === username)!;
    }
    const newProfile: Profile = {
      id: Math.random().toString(36).substr(2, 9),
      username,
      type,
      lastUsed: Date.now(),
    };
    profiles.push(newProfile);
    saveProfiles(profiles);
    this.setCurrentProfile(username); // Set as current after adding
    return newProfile;
  },

  deleteProfile(username: string): boolean {
    let profiles = getProfiles();
    const initialLength = profiles.length;
    profiles = profiles.filter(p => p.username !== username);
    saveProfiles(profiles);

    // If the deleted profile was the current one, clear current user
    if (this.getCurrentProfile() === username) {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
    return profiles.length < initialLength; // True if a profile was actually deleted
  },

  setCurrentProfile(username: string): boolean {
    const profiles = getProfiles();
    const profileExists = profiles.some(p => p.username === username);
    if (profileExists) {
      localStorage.setItem(CURRENT_USER_KEY, username);
      // Update lastUsed timestamp
      const updatedProfiles = profiles.map(p => 
        p.username === username ? { ...p, lastUsed: Date.now() } : p
      );
      saveProfiles(updatedProfiles);
      return true;
    }
    return false;
  },

  getCurrentProfile(): string | null {
    return localStorage.getItem(CURRENT_USER_KEY);
  },

  // Placeholder for user authentication (e.g., Microsoft OAuth flow)
  authenticateMicrosoft(): Promise<Profile> {
    return new Promise((resolve, reject) => {
      // Simulate OAuth flow
      setTimeout(() => {
        const username = `MicrosoftUser_${Math.random().toString(36).substr(2, 5)}`;
        try {
          const profile = this.addProfile(username, 'microsoft');
          resolve(profile);
        } catch (error) {
          reject(error);
        }
      }, 1000);
    });
  },

  setSkinForProfile(username: string, skinUrl: string): boolean {
    const profiles = getProfiles();
    const profileIndex = profiles.findIndex(p => p.username === username);
    if (profileIndex !== -1) {
      profiles[profileIndex].skinUrl = skinUrl;
      saveProfiles(profiles);
      return true;
    }
    return false;
  },

  getSkinForProfile(username: string): string | undefined {
    const profile = this.getProfileByUsername(username);
    return profile?.skinUrl;
  },
};