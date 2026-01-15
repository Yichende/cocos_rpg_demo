import {
  _decorator,
  Component,
  Camera,
  find,
  UITransform,
  view,
  Node,
  Vec3,
  TiledMap,
} from "cc";

const { ccclass, property } = _decorator;

@ccclass("CameraController")
export class CameraController extends Component {
  @property(Node)
  RoleNode: Node | null = null;

  @property
  smooth: number = 0;

  @property(Node)
  mapsNode: Node | null = null;

  private _tempPos = new Vec3();
  private _minX = 0;
  private _maxX = 0;
  private _minY = 0;
  private _maxY = 0;
  private camera!: Camera;
  private world!: Node;

  public setMapsNode(mapsNode: Node) {
    this.mapsNode = mapsNode;
    this.onResolutionChange();
  }

  public recalcBounds() {
    if (!this.mapsNode) {
      console.error("[CameraController] mapNode Not Found");
      return;
    }

    const camera = this.getComponent(Camera)!;
    const halfViewHeight = camera.orthoHeight;

    const visibleSize = view.getVisibleSize();
    const aspect = visibleSize.width / visibleSize.height;
    const halfViewWidth = halfViewHeight * aspect;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const maps = this.mapsNode.getComponentsInChildren(TiledMap);
    if (maps.length === 0) {
      console.warn('[MapManager]: Maps Not Found');
    }

    for (const tiledMap of maps) {
      const mapSize = tiledMap.getMapSize();
      const tileSize = tiledMap.getTileSize();

      const mapWidth = mapSize.width * tileSize.width;
      const mapHeight = mapSize.height * tileSize.height;

      const pos = tiledMap.node.worldPosition.clone();

      const left = pos.x - mapWidth;
      const right = pos.x + mapWidth;
      const bottom = pos.y - mapHeight;
      const top = pos.y + mapHeight;

      minX = Math.min(minX, left);
      maxX = Math.max(maxX, right);
      minY = Math.min(minY, bottom);
      maxY = Math.max(maxY, top);
    }

    this._minX = minX + halfViewWidth;
    this._maxX = maxX - halfViewWidth;
    this._minY = minY + halfViewHeight;
    this._maxY = maxY - halfViewHeight;

    // 地图比视口小的兜底处理
    if (this._minX > this._maxX) {
      this._minX = this._maxX = (minX + maxX) / 2;
    }
    if (this._minY > this._maxY) {
      this._minY = this._maxY = (minY + maxY) / 2;
    }
  }

  private onResolutionChange() {
    this.updateCameraSize();
    this.recalcBounds();
  }

  onLoad() {
    this.camera = this.getComponent(Camera)!;

    // 监听分辨率变化（Web / PC / 旋转屏幕）
    view.on("design-resolution-changed", this.onResolutionChange, this);
  }

  protected start(): void {
    this.world = find("Canvas/World")!;

    if (!this.world) {
      console.error("[CameraController] World Not Found");
      return;
    }

    // this.onResolutionChange();
  }

  protected lateUpdate(dt: number): void {
    if (!this.RoleNode) return;
    const RolePos = this.RoleNode.worldPosition.clone();
    const CameraPos = this.node.worldPosition.clone();

    if (this._minX > this._maxX || this._minY > this._maxY) {
      console.log("触发非法边界");
      return;
    }

    RolePos.x = Math.min(this._maxX, Math.max(this._minX, RolePos.x));
    RolePos.y = Math.min(this._maxY, Math.max(this._minY, RolePos.y));

    if (this.smooth <= 0) {
      this.node.setWorldPosition(RolePos);
    } else {
      Vec3.lerp(this._tempPos, CameraPos, RolePos, this.smooth);

      this.node.setWorldPosition(this._tempPos);
    }
  }

  onDestroy() {
    view.off("design-resolution-changed", this.onResolutionChange, this);
  }

  updateCameraSize() {
    const canvas = find("Canvas");
    if (!canvas || !this.world) return;

    const uiTransform = canvas.getComponent(UITransform);
    if (!uiTransform) return;

    // World 的缩放（只关心 Y）
    const worldScaleY = canvas.getWorldScale().y;
    const canvasHeight = uiTransform.contentSize.height / worldScaleY;
    this.camera.orthoHeight = canvasHeight / 2;
  }
}
