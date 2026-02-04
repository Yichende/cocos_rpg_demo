import { resources, Prefab } from "cc";
export type ItemType = "consumable" | "quest";

export interface ItemConfig {
  id: number;
  name: string;
  type: ItemType;
  desc: string;
  iconPath: string; // 资源路径
  iconPrefab?: Prefab;
  stack: number;
  effect?: { [key: string]: number };
}

interface RawItemConfig { // 对应json
  name: string;
  desc: string;
  iconPath: string;
  type: ItemType;
  stack: number;
  effect?: { [key: string]: number};
}

export class ItemConfigTable {
    private static _items = new Map<number, ItemConfig>();
  
    static load(raw: Record<string, RawItemConfig>) {
        Object.keys(raw).forEach((key) => {
          const id = Number(key);
          const data = raw[key];
      
          const config: ItemConfig = {
            id,
            name: data.name,
            desc: data.desc,
            type: data.type,
            iconPath: data.iconPath,
            stack: data.stack,
            effect: data.effect,
          };
      
          this._items.set(id, config);
      
          resources.load(data.iconPath, Prefab, (err, prefab) => {
            if (err) {
                console.error(`加载物品 prefab 失败: ${data.iconPath}`, err);
                return;
            }
            config.iconPrefab = prefab;
          });
        });
      }
  
    static get(id: number): ItemConfig | null {
      return this._items.get(id) ?? null;
    }
  }
