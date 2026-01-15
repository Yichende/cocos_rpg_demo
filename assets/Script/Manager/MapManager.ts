import {
  _decorator,
  Component,
  Node,
  Prefab,
  instantiate,
  resources,
} from "cc";
import { FogOfWarController } from "../Controller/FogOfWarController";
import { CameraController } from "../Controller/MainCameraController";

const { ccclass, property } = _decorator;

@ccclass("MapManager")
export class MapManager extends Component {
  /** 地图挂载的父节点，一般是 World */
  @property(Node)
  mapRoot: Node | null = null;

  /** Fog 控制器 */
  @property(FogOfWarController)
  fogController: FogOfWarController | null = null;

  @property(CameraController)
  cameraController: CameraController | null = null;

  /** 当前加载的地图实例 */
  private _currentMap: Node | null = null;

  protected start(): void {
      this.loadMap('firstMap');
  }

  /**
   * 加载并生成地图
   * @param mapName PrefabMaps 下的 prefab 名称（不带后缀）
   */
  loadMap(mapName: string) {
    const path = `map/PrefabMaps/${mapName}`;

    resources.load(path, Prefab, (err, prefab) => {
      if (err) {
        console.error(`[MapManager] 地图加载失败: ${path}`, err);
        return;
      }

      this._spawnMap(prefab);
    });
  }

  /**
   * 实例化地图
   */
  private _spawnMap(prefab: Prefab) {
    // 清理旧地图
    if (this._currentMap) {
      this._currentMap.destroy();
      this._currentMap = null;
    }

    // 实例化
    const mapNode = instantiate(prefab);
    mapNode.setParent(this.mapRoot!);
    mapNode.setPosition(0, 0, 0);

    this._currentMap = mapNode;

    // 通知 Camera
    if (this.cameraController) {
      console.log('通知Camera')
      this.cameraController.setMapsNode(mapNode);
    }

    // 通知 FogOfWar
    if (this.fogController) {
      console.log('通知Fog')
      this.fogController.setMapRoot(mapNode);
      this.fogController.setEnabled(true);
    }

    console.log("[MapManager] 地图生成完成");
  }

  /**
   * 关闭战争迷雾（例如进入过场、战斗）
   */
  disableFog() {
    this.fogController?.setEnabled(false);
  }

  /**
   * 开启战争迷雾
   */
  enableFog() {
    this.fogController?.setEnabled(true);
  }

  /**
   * 获取当前地图节点（给其他系统用）
   */
  getCurrentMap(): Node | null {
    return this._currentMap;
  }
}
