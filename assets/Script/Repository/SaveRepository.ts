import { sys } from 'cc';

export interface BagItem {
    itemId: number;
    count: number;
}

export interface SaveData {
    version: number;
    bag: BagItem[];
}

const SAVE_KEY = 'test_save_slot';

export class SaveRepository {

    static load(): SaveData {
        const raw = sys.localStorage.getItem(SAVE_KEY);
        if (!raw) {
            return { version: 1, bag: [] };
        }
        return JSON.parse(raw);
    }

    static save(data: SaveData) {
        sys.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    }

    static clear() {
        sys.localStorage.removeItem(SAVE_KEY);
    }
}
