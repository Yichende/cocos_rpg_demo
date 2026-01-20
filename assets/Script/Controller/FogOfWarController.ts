import {
  _decorator,
  Component,
  Node,
  TiledMap,
  TiledLayer,
  UITransform,
  Vec2,
  Vec3,
  Rect,
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
  visionRadiusWorld = 150;

  @property({ type: Node, tooltip: "视野阴影节点(World/FogMask/VisionShadow)" })
  visionShadow: Node | null = null;

  @property({ tooltip: "阻挡视野的图层名" })
  blockLayerName = "wall";

  private maps: MapFogData[] = [];
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

    if (enabled) {
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

    console.log(`FogOfWar: 已加载 ${this.maps.length} 个地图块`);
  }

  private transformX(dx: number, dy: number, octant: number): number {
    switch (octant) {
      case 0:
        return dx;
      case 1:
        return dy;
      case 2:
        return dy;
      case 3:
        return dx;
      case 4:
        return -dx;
      case 5:
        return -dy;
      case 6:
        return -dy;
      case 7:
        return -dx;
      default:
        return 0;
    }
  }

  private transformY(dx: number, dy: number, octant: number): number {
    switch (octant) {
      case 0:
        return dy;
      case 1:
        return dx;
      case 2:
        return -dx;
      case 3:
        return -dy;
      case 4:
        return -dy;
      case 5:
        return -dx;
      case 6:
        return dx;
      case 7:
        return dy;
      default:
        return 0;
    }
  }

  private castLight(
    mapData: MapFogData,
    origin: Vec2,
    row: number,
    startSlope: number,
    endSlope: number,
    radius: number,
    octant: number
  ) {
    if (startSlope < endSlope) return;

    const map = mapData.map;
    const smog = mapData.smog;
    const explored = mapData.explored;

    let nextStartSlope = startSlope;

    for (let distance = row; distance <= radius; distance++) {
      let blocked = false;

      for (let dx = -distance, dy = -distance; dx <= 0; dx++) {
        const lSlope = (dx - 0.5) / (dy + 0.5);
        const rSlope = (dx + 0.5) / (dy - 0.5);

        if (rSlope > startSlope) continue;
        if (lSlope < endSlope) break;

        const tileX = origin.x + this.transformX(dx, dy, octant);
        const tileY = origin.y + this.transformY(dx, dy, octant);

        if (
          tileX < 0 ||
          tileY < 0 ||
          tileX >= smog.getLayerSize().width ||
          tileY >= smog.getLayerSize().height
        ) {
          continue;
        }

        // 距离检测（圆形）
        if (dx * dx + dy * dy <= radius * radius) {
          smog.setTileGIDAt(0, tileX, tileY);
          explored[tileX][tileY] = true;
        }

        const isWall = this.isBlocked(map, tileX, tileY);

        if (blocked) {
          if (isWall) {
            nextStartSlope = rSlope;
            continue;
          } else {
            blocked = false;
            startSlope = nextStartSlope;
          }
        } else {
          if (isWall && distance < radius) {
            blocked = true;
            this.castLight(
              mapData,
              origin,
              distance + 1,
              startSlope,
              lSlope,
              radius,
              octant
            );
            nextStartSlope = rSlope;
          }
        }
      }

      if (blocked) break;
    }
  }

  private revealByShadowCasting(
    mapData: MapFogData,
    origin: Vec2,
    radiusTiles: number
  ) {
    // 8 个象限
    for (let octant = 0; octant < 8; octant++) {
      this.castLight(mapData, origin, 1, 1.0, 0.0, radiusTiles, octant);
    }
  }

  // 判断某个 tile 是否阻挡视野
  private isBlocked(map: TiledMap, x: number, y: number): boolean {
    const blockLayer = map.getLayer(this.blockLayerName);
    if (!blockLayer) return false;

    const size = blockLayer.getLayerSize();

    // 越界的tile视为阻挡，而不是阻挡的tile本身
    if (x < 0 || y < 0 || x >= size.width || y >= size.height) {
      return true;
    }

    return blockLayer.getTileGIDAt(x, y) !== 0;
  }

  // 更新迷雾
  private updateFog() {
    const current = this.findCurrentMap();
    if (!current || !this.role) return;

    for (const mapData of this.maps) {
      const isCurrentMap = mapData === current;
      this.revealMapWithWorldVision(mapData, isCurrentMap);
    }
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

  /**
   * 根据角色的世界视野进行迷雾清除
   */
  private revealMapWithWorldVision(mapData: MapFogData, isCurrentMap: boolean) {
    const map = mapData.map;
    const smog = mapData.smog;
    const explored = mapData.explored;

    const rolePos = this.role!.worldPosition;
    const r = this.visionRadiusWorld;

    const tileSize = map.getTileSize();
    const visionRadiusTiles = Math.floor(
      this.visionRadiusWorld / Math.min(tileSize.width, tileSize.height)
    );

    const ui = map.node.getComponent(UITransform)!;
    const mapRect = ui.getBoundingBoxToWorld();

    // Map 完全不在视野范围，跳过
    if (
      !mapRect.intersects(new Rect(rolePos.x - r, rolePos.y - r, r * 2, r * 2))
    ) {
      return;
    }

    let roleTile: Vec2 | null = null;
    if (isCurrentMap) {
      roleTile = this.worldToTile(map, rolePos);
    }

    if (!isCurrentMap || !roleTile) return;

    // 角色所在 tile 必须可见
    smog.setTileGIDAt(0, roleTile.x, roleTile.y);
    explored[roleTile.x][roleTile.y] = true;

    // Shadow Casting
    this.revealByShadowCasting(mapData, roleTile, visionRadiusTiles);
  }
}
