import { _decorator, BoxCollider2D, CCBoolean, CCString, CircleCollider2D, Collider2D, Component, ECollider2DType, EPhysics2DDrawFlags, Graphics, ImageAsset, instantiate, Node, PhysicsSystem2D, PolygonCollider2D, Pool, Prefab, resources, Size, size, SpriteFrame, TiledLayer, TiledMap, TiledObjectGroup, v2, v3, Vec2 } from 'cc';
const { ccclass, property } = _decorator;
@ccclass('GameDevelopment')
export class GameDevelopment extends Component {
    @property(CCBoolean)
    addMapCollider: boolean = true;
    @property(CCBoolean)
    collisionDetection: boolean = false;

    //碰撞体预制体
    static prefabMap: Map<string, Prefab> = new Map();
    //返回promise对象便于其他脚本获取加载后的资源
    static resourceLoadingPromise: Promise<void>;

    onLoad() {
        //加载碰撞体预制体
        GameDevelopment.resourceLoadingPromise = this.loadObstaclePrefabs();
        if (this.collisionDetection) {
            PhysicsSystem2D.instance.debugDrawFlags =
            EPhysics2DDrawFlags.Shape;
        }
    }
    onDestroy(){
        GameDevelopment.prefabMap.clear();
        GameDevelopment.resourceLoadingPromise = null;
    }
    start() {
        if (this.collisionDetection) {
            setTimeout(() => {
                const draw = this.node.getChildByName('PHYSICS_2D_DEBUG_DRAW');
                const graphics = draw.getComponent(Graphics);
                graphics.lineWidth = 1;
                graphics.miterLimit = 1;
            }, 1);
        }
    }

    private loadObstaclePrefabs(): Promise<void> {

        return new Promise((resolve, reject) => {
                if(this.addMapCollider){
                    resources.loadDir("Collider", Prefab, (err: Error | null, prefabs: Prefab[]) => {
                        if (err) {
                            reject(err);
                        } else {
                            prefabs.forEach(prefab => {
                                GameDevelopment.prefabMap.set(prefab.name, prefab);
                            });
                            resolve();
                        }
                    });
                }else{
                    reject('不添加碰撞体')
                }

        });
    }
}


