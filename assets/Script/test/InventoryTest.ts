import { _decorator, Component, resources, JsonAsset, error, find } from 'cc';
import { ItemConfigTable } from '../Data/ItemConfig';
import { InventoryRepository } from '../Repository/InventoryRepository';
import { SaveRepository } from '../Repository/SaveRepository';
import { BagPanel } from '../UI/Bag/BagPanel';
const { ccclass } = _decorator;

@ccclass('InventoryTest')
export class InventoryTest extends Component {

    async onLoad () {

        // 清空旧存档
        SaveRepository.clear();

        // 加载物品配置
        resources.load('data/items', JsonAsset, (err: any, items: JsonAsset) => {
            if (err) {
                error(err.message || err);
                return;
            }

            const itemsData = items.json!;

            ItemConfigTable.load(itemsData);

            const bag = new InventoryRepository();

            bag.addItem(1001, 5);
            bag.addItem(1002, 3);
            bag.addItem(2001, 1);
            bag.addItem(2002, 1);

            bag.removeItem(1001, 2);

            console.log('治疗药水数量:', bag.getItemCount(1001));
            console.log('钥匙是否存在:', bag.hasItem(2001));
            console.log('背包数据:', bag.items);

            const bagPanel = find('Canvas/UI/BagPanel')?.getComponent(BagPanel);
            if (!bagPanel) {
                error('BagPanel not found');
                return;
              }
        
              bagPanel.setInventory(bag);
        });
    }
}
