import {
  _decorator,
  Component,
  Node,
  TiledMap,
  TiledLayer,
  UITransform,
  Vec2,
  Vec3,
  Sprite,
} from "cc";

const { ccclass, property } = _decorator;

interface MapFogData {
  map: TiledMap;
  smog: TiledLayer;
  explored: boolean[][];
}

@ccclass("FogOfWarController")
export class FogOfWarController extends Component {
  @property({ type: Node, tooltip: "World/role" })
  role: Node | null = null;

  @property({ tooltip: "迷雾图层名" })
  smogLayerName = "smog";

  @property({ tooltip: "视野半径（世界坐标，像素）" })
  visionRadiusWorld = 200;

  @property({ type: Node, tooltip: "视野阴影节点(World/FogMask/VisionShadow)" })
  visionShadow: Node | null = null;

  private maps: MapFogData[] = [];
  private lastMap: TiledMap | null = null;
  private lastTile: Vec2 | null = null;
  private _shadowEnabled = false; // 战争迷雾与阴影图层
  private _mapRoot: Node | null = null;

  start() {
    if (!this.role) {
      console.error("FogOfWar: role 未设置");
      return;
    }

    this.setEnabled(false);
  }

  update() {
    if (!this._shadowEnabled || !this.role || this.maps.length === 0) return;
    this.updateFog();
    this.updateVisionShadow();
  }

  public setMapRoot(mapRoot: Node) {
    this._mapRoot = mapRoot;
    this.collectMaps();
  }

  // 启停Fog Shadow
  public setEnabled(enabled: boolean) {
    this._shadowEnabled = enabled;

    // 控制smog显示
    for (const layer of this.maps) {
      layer.smog.node.active = enabled;
    }

    // 控制shadow图片显示
    if (this.visionShadow) {
      this.visionShadow.active = enabled;
    }

    if (!enabled) {
      this.lastMap = null;
      this.lastTile = null;
    } else {
      this.initShadowSize();
    }
  }

  // Shadow跟随角色控制
  private updateVisionShadow() {
    if (!this.visionShadow || !this.role) return;
    this.visionShadow.setWorldPosition(this.role.worldPosition);
  }

  // 初始化Shadow Sprite尺寸
  private initShadowSize() {
    if (!this.visionShadow) return;

    const ui = this.visionShadow.getComponent(UITransform);
    if (!ui) {
      console.warn("FogOfWarController: VisionShadow 缺少 UITransform");
      return;
    }

    // 固定一个足够大的遮罩尺寸（推荐 2048 × 2048）
    ui.setContentSize(2048, 2048);

    // 使用原始比例，不再做基于视野半径的缩放
    this.visionShadow.setScale(1, 1, 1);
  }

  /** 收集所有子地图 */
  private collectMaps() {
    this.maps = [];

    for (const child of this._mapRoot!.children) {
      const map = child.getComponent(TiledMap);
      if (!map) continue;

      const smog = map.getLayer(this.smogLayerName);
      if (!smog) {
        console.warn(`[FogOfWar]: ${child.name} 缺少smog图层`);
        continue;
      }
      smog.node.active = this._shadowEnabled;

      const size = smog.getLayerSize();
      const explored = Array.from({ length: size.width }, () =>
        Array(size.height).fill(false)
      );

      this.maps.push({ map, smog, explored });
    }

    this.lastMap = null;
    this.lastTile = null;

    console.log(`FogOfWar: 已加载 ${this.maps.length} 个地图块`);
  }

  // private buildMapFogData(mapNode: Node) {
  //   const map = mapNode.getComponent(TiledMap);
  //   if (!map) {
  //     console.error("[FogOfWar]: MapRoot 上没有 TiledMap");
  //     return;
  //   }

  //   const smog = map.getLayer(this.smogLayerName);
  //   if (!smog) {
  //     console.error(`[FogOfWar]: ${mapNode.name} 缺少smog图层`);
  //     return;
  //   }

  //   const size = smog.getLayerSize();
  //   const explored = Array.from({ length: size.width }, () =>
  //     Array(size.height).fill(false)
  //   );

  //   this._mapData = {
  //     map,
  //     smog,
  //     explored,
  //   };

  //   smog.node.active = this._shadowEnabled;

  //   // this.lastMap = null;
  //   this.lastTile = null;
  // }

  /** 更新迷雾（仅当前所在地图） */
  private updateFog() {
    const mapData = this.findCurrentMap();
    if (!mapData) return;

    const tilePos = this.worldToTile(mapData.map, this.role!.worldPosition);

    if (
      this.lastMap === mapData.map &&
      this.lastTile &&
      tilePos.equals(this.lastTile)
    ) {
      return;
    }

    this.revealWithWorldRadius(mapData, tilePos.x, tilePos.y);

    this.lastMap = mapData.map;
    this.lastTile = tilePos;
  }

  /** 找到角色当前所在的地图块 */
  private findCurrentMap(): MapFogData | null {
    const pos = this.role!.worldPosition.clone();

    for (const data of this.maps) {
      const ui = data.map.node.getComponent(UITransform)!;
      const rect = ui.getBoundingBoxToWorld();

      if (rect.contains(new Vec2(pos.x, pos.y))) {
        return data;
      }
    }

    return null;
  }

  /** 世界坐标 → tile 坐标（针对指定 map） */
  private worldToTile(map: TiledMap, world: Vec3): Vec2 {
    const ui = map.node.getComponent(UITransform)!;
    const local = ui.convertToNodeSpaceAR(world);

    const tileSize = map.getTileSize();
    const mapSize = map.getMapSize();

    const originX = -mapSize.width * tileSize.width * 0.5;
    const originY = -mapSize.height * tileSize.height * 0.5;

    const x = Math.floor((local.x - originX) / tileSize.width);
    // 先算“自下而上”的 y
    const rawY = Math.floor((local.y - originY) / tileSize.height);

    // 翻转为 Tiled 的 tile Y（自上而下）
    const y = mapSize.height - 1 - rawY;

    return new Vec2(x, y);
  }

  private revealWithWorldRadius(mapData: MapFogData, cx: number, cy: number) {
    const map = mapData.map;
    const tileSize = map.getTileSize();

    const centerWorld = this.role!.worldPosition.clone();
    const step = tileSize.width;

    const r = this.visionRadiusWorld;

    for (let dx = -r; dx <= r; dx += step) {
      for (let dy = -r; dy <= r; dy += step) {
        if (dx * dx + dy * dy > r * r) continue;
        const world = new Vec3(centerWorld.x + dx, centerWorld.y + dy, 0);

        this.revealAtWorld(world);
      }
    }
  }

  // 清除迷雾
  private revealAtWorld(worldPos: Vec3) {
    for (const data of this.maps) {
      const map = data.map;
      const smog = data.smog;
      const explored = data.explored;

      const tilePos = this.worldToTile(map, worldPos);
      const size = smog.getLayerSize();

      if (
        tilePos.x < 0 ||
        tilePos.y < 0 ||
        tilePos.x >= size.width ||
        tilePos.y >= size.height
      ) {
        continue;
      }

      if (explored[tilePos.x][tilePos.y]) return;

      smog.setTileGIDAt(0, tilePos.x, tilePos.y);
      explored[tilePos.x][tilePos.y] = true;
      return;
    }
  }
}
