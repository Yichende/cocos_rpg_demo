import { _decorator, Component, Node } from "cc";
const { ccclass, property } = _decorator;

@ccclass("GameManager")
export class GameManager extends Component {
  protected onLoad(): void {
    let p = cc.director.getPhysicsManager();
    p.enabled = true;
    p.debugDrawFlags = true;
    p.gravity = cc.v2(0, 0);
  }
  start() {
    let tiledSize = this.tiledMap.getTileSize();
    let layer = this.tiledMap.getLayer('wall');
    let layerSize = layer.getLayerSize();

    for (let i = 0; i < layerSize.width; i++) {
        for (let j = 0; j < layerSize.height; j++) {
            let tiled = layer.getTiledTileAt(i, j, true);
            if (tiled.gid != 0) {
                tiled.node.group = "wall";
                let body = tiled.node.addComponent(cc.RigidBody);
                body.type = cc.RigidBodyType.Static;
                let collider = tiled.node.addComponent(cc.PhysicsBoxCollider);
                collider.offset = cc.v2(tiledSize.width / 2, tiledSize.height / 2);
                collider.size = tiledSize;
                collider.apply();

            }
        }
    }
  }

  update(deltaTime: number) {}
}
