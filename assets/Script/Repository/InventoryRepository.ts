import { ItemConfigTable } from '../Data/ItemConfig';
import { SaveRepository, BagItem, SaveData } from './SaveRepository';

export class InventoryRepository {

    private _data: SaveData;

    constructor() {
        this._data = SaveRepository.load();
    }

    get items(): readonly BagItem[] {
        return this._data.bag;
    }

    getItemCount(itemId: number): number {
        return this._data.bag.find(i => i.itemId === itemId)?.count ?? 0;
    }

    addItem(itemId: number, count = 1): boolean {
        const config = ItemConfigTable.get(itemId);
        if (!config) return false;

        const item = this._data.bag.find(i => i.itemId === itemId);

        if (item) {
            item.count = Math.min(item.count + count, config.stack);
        } else {
            this._data.bag.push({
                itemId,
                count: Math.min(count, config.stack),
            });
        }

        SaveRepository.save(this._data);
        return true;
    }

    removeItem(itemId: number, count = 1): boolean {
        const item = this._data.bag.find(i => i.itemId === itemId);
        if (!item || item.count < count) return false;

        item.count -= count;

        if (item.count <= 0) {
            this._data.bag = this._data.bag.filter(i => i !== item);
        }

        SaveRepository.save(this._data);
        return true;
    }

    hasItem(itemId: number, count = 1): boolean {
        return this.getItemCount(itemId) >= count;
    }

    clear() {
        this._data.bag = [];
        SaveRepository.save(this._data);
    }
}
