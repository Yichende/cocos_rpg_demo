import {
  _decorator,
  BoxCollider2D,
  CCBoolean,
  CircleCollider2D,
  Collider2D,
  Component,
  director,
  ECollider2DType,
  ERigidBody2DType,
  error,
  instantiate,
  math,
  Node,
  PolygonCollider2D,
  Pool,
  Prefab,
  resources,
  RigidBody2D,
  Size,
  size,
  Sprite,
  TiledLayer,
  TiledMap,
  TiledObjectGroup,
  v2,
  v3,
  Vec2,
} from "cc";
import { ColliderGroup } from "./ColliderGroup";
import { GridColliderMap } from "./TileGrid";
import { GameDevelopment } from "./GameDevelopment";
const { ccclass, property } = _decorator;
//初始碰撞体最好不要有重复点，否则有一定几率会导致碰撞体顶点丢失
@ccclass("MapController")
export class MapController extends Component {
  //是否添加碰撞体
  @property(CCBoolean)
  addMapCollider: boolean = true;

  //是否合并碰撞体
  @property(CCBoolean)
  mergeCollider: boolean = true;

  //是否进一步优化碰撞体(若出现碰撞体顶点丢失的情况，可尝试关闭此选项)
  @property(CCBoolean)
  advancedOptimize: boolean = true;

  //是否合并不同图层的碰撞体（警告！开启本选项有可能会导致碰撞体过于复杂而无法生成，情自行斟酌是否启用）
  @property(CCBoolean)
  mergeDifferentLayers: boolean = false;

  //是否输出当前地图的grid信息
  @property(CCBoolean)
  outputGridInfo: boolean = false;

  //碰撞体的碰撞分组
  private colliderGroup: number = ColliderGroup.WALL;
  private map: TiledMap = null;
  private layers: TiledLayer[] = null;
  private objectLayers: TiledObjectGroup[] = null;
  private Obstacle: Node = null;
  private tileSize: Size = null;
  private mapSize: Size = null;
  private originalColliderNodeMapIndex: number = 0;
  //瓦块碰撞体的关系
  private NameToGrid: Map<string, number> = new Map();
  private GridToName: Map<number, string> = new Map();
  //碰撞体预制体
  prefabMap: Map<string, Prefab> = new Map();
  //碰撞体自身的顶点哈希表
  vertexMap: Map<number, Vec2[]> = new Map();
  //顶点处拥有的碰撞体哈希表
  vertexColliderMap: Map<String, number[]> = new Map();
  //合并碰撞体时的主碰撞体
  mainColliderIndexMap: Map<number, number> = new Map();
  //主碰撞体拥有的副碰撞体
  mainColliderWithOthersIndexMap: Map<number, number[]> = new Map();
  //多边形碰撞体哈希表
  polygonPointsMap: Map<number, Vec2[]> = new Map();
  //处理后的多边形碰撞体
  optimizePolygonPointsMap: Map<number, Vec2[]> = new Map();
  //瓦块碰撞体节点
  originalColliderNodeMap: Map<number, Node> = new Map();
  originalColliderfindMap: Map<String, number> = new Map();
  onLoad() {
    if (this.addMapCollider) {
      //获取当前地图信息
      this.map = this.node.getComponent(TiledMap);
      this.getMapInfo();
      GameDevelopment.resourceLoadingPromise.then(
        () => {
          const timeBegin = Date.now();
          //获取当前map的瓦块对应的grid
          this.getTiledGrid(this.map);
          this.prefabMap = GameDevelopment.prefabMap;
          //用了slice是为了删掉名称后面的<TiledMap>
          const mapName = this.map.name.slice(0, -10);
          console.log("开始处理地图", mapName);
          //如果要合并不同图层的碰撞体，则先将所有图层的瓦块碰撞体添加到碰撞体节点表中
          if (this.mergeDifferentLayers) {
            const time1 = Date.now();
            console.log("获取瓦块碰撞体耗时", time1 - timeBegin);
            this.layers.forEach((layer) => {
              if (layer.node.active === true) {
                this.addCollider(layer);
              }
            });
            const time2 = Date.now();
            if (this.mergeCollider) {
              //然后获取所有碰撞点并计算出多边形碰撞数组
              console.log("添加与合并碰撞体耗时", time2 - time1);
              //优化多边形碰撞体
              this.optimizeAllPolygonPoints();
              const time3 = Date.now();
              console.log("优化碰撞体耗时", time3 - time2);
              //添加碰撞体
              this.addColliderToMap();
              const time4 = Date.now();
              console.log("添加碰撞体耗时", time4 - time3);
              console.log("总耗时", time4 - timeBegin);
            } else {
              console.log("添加碰撞体耗时", time2 - time1);
            }
          } else {
            //如果不合并不同图层的碰撞体，就添加一次图层就获取一次碰撞体节点表
            this.layers.forEach((layer) => {
              if (layer.node.active === true) {
                //先清理之前图层的遗留数据
                this.vertexMap.clear();
                this.vertexColliderMap.clear();
                this.mainColliderIndexMap.clear();
                this.mainColliderWithOthersIndexMap.clear();
                this.polygonPointsMap.clear();
                this.optimizePolygonPointsMap.clear();
                this.originalColliderNodeMap.clear();
                //获取当前图层的碰撞层
                this.Obstacle = layer.node.getChildByName("Obstacle");
                //用了slice是为了删掉名称后面的<TiledLayer>
                const layerName = layer.name.slice(0, -12);
                console.log("开始处理图层", layerName);
                const time1 = Date.now();
                this.addCollider(layer);
                const time2 = Date.now();
                console.log("初步添加碰撞体耗时", time2 - time1);
                if (this.mergeCollider) {
                  //获取当前图层的碰撞点并计算出多边形碰撞数组
                  this.mergeAllColliders();
                  const time3 = Date.now();
                  console.log("合并碰撞体耗时", time3 - time2);
                  this.optimizeAllPolygonPoints();
                  const time4 = Date.now();
                  console.log("优化碰撞体耗时", time4 - time3);
                  this.addColliderToMap();
                  const time5 = Date.now();
                  console.log("添加碰撞体耗时", time5 - time4);
                }
              }
            });
            const timeEnd = Date.now();
            console.log("总耗时", timeEnd - timeBegin);
          }
        },
        (err) => {
          if (err === "不添加碰撞体") {
            return;
          } else {
            console.error(err);
          }
        }
      );
    }
  }
  start() {
    //添加对象碰撞
    this.addColliderToObject(this.objectLayers);
  }

  onDestroy() {
    this.originalColliderNodeMapIndex = 0;
    this.NameToGrid.clear();
    this.GridToName.clear();
    this.prefabMap.clear();
    this.vertexMap.clear();
    this.vertexColliderMap.clear();
    this.mainColliderIndexMap.clear();
    this.polygonPointsMap.clear();
    this.mainColliderWithOthersIndexMap.clear();
    this.optimizePolygonPointsMap.clear();
    this.originalColliderNodeMap.clear();
  }

  //获取指定地图的瓦块对应的grid
  getTiledGrid(map: TiledMap) {
    const _tilesets = map._tilesets;
    const lastTileset = _tilesets[_tilesets.length - 1];
    const firstGid = lastTileset.firstGid;
    let MaxMapTileCount = 0;
    //判断最后一个图集是不是多张图片的集合
    if (lastTileset.collection) {
      //如果是，则MaxMapTileCount为firstGid（对于多张图片的集合来说，firstGid实际上是最后一个gid）
      MaxMapTileCount = firstGid;
    } else {
      //如果最后一个图块集拉伸了一像素，则MaxMapTileCount有可能超过实际的数量，但不影响程序运行
      //实际上，由于在多图集合中imageSize=_tileSize，因此该方法计算的MaxMapTileCount即使是多图集合也能得出正确结果,但为了代码可读性考虑还是分开写
      const tilecount =
        (lastTileset.imageSize.width / lastTileset._tileSize.width) *
        (lastTileset.imageSize.height / lastTileset._tileSize.height);
      MaxMapTileCount = firstGid + tilecount - 1;
    }
    //输出每个拥有type属性的tile的grid
    for (let i = 1; i <= MaxMapTileCount; i++) {
      const property = map.getPropertiesForGID(i);
      if (property) {
        if (property.type) {
          const typeStr = property.type.toString();
          this.GridToName.set(i, typeStr);
          this.NameToGrid.set(typeStr, i);
        }
      }
    }
    //如果outputGridInfo为true，则在控制台打印出当前地图grid与瓦块的关系
    if (this.outputGridInfo) {
      console.log("当前地图", map.name, "瓦块对应的grid信息如下——");
      console.log("grid对应的瓦块", this.GridToName);
      console.log("瓦块对应的grid", this.NameToGrid);
    }
  }
  //获取指定地图的信息
  getMapInfo() {
    //获取地图的大小（瓦片块数）
    this.mapSize = this.map.getMapSize();
    //获取地图的图像层
    this.layers = this.map.getLayers();
    //获取地图的对象层
    this.objectLayers = this.map.getObjectGroups();
    //获取一个块的像素大小
    this.tileSize = this.map.getTileSize();
    //获取碰撞层Obstacle，碰撞体会挂载在这个节点下(如果没有则创建)
    if (this.mergeDifferentLayers) {
      const obstacleNode = this.map.node.getChildByName("Obstacle");
      if (obstacleNode) {
        this.Obstacle = obstacleNode;
      } else {
        this.Obstacle = new Node("Obstacle");
        this.map.node.addChild(this.Obstacle);
      }
    } else {
      //如果不合并不同图层的碰撞体，则为每一个图层创建一个碰撞层
      this.layers.forEach((layer) => {
        const obstacleNode = new Node("Obstacle");
        layer.node.addChild(obstacleNode);
      });
    }
  }

  //为图层的每一个瓦块添加碰撞体
  addCollider(layer: TiledLayer) {
    if (!layer) {
      return;
    }
    //如果图层不激活，则不添加碰撞体
    if (layer.node.active === false) {
      return;
    }
    //获取图层的块数（如没有修改，一般就是地图的块数）
    const layerSize = layer.getLayerSize();
    for (let i = 0; i < layerSize.height; i++) {
      for (let j = 0; j < layerSize.width; j++) {
        //获取当前块的grid
        const grid = layer.getTileGIDAt(j, i);
        if (grid != 0) {
          const colliderType = this.getCollider(grid);
          if (colliderType) {
            const prefab = this.prefabMap.get(colliderType);
            let colliderNode = instantiate(prefab);
            //将碰撞体节点中心设为tile的中心，因为默认位置(0,0)在地图正中心，所以宽要-this.mapSize.width/2，高要+this.mapSize.height/2，此时碰撞体节点的中心在地图左上角
            //将宽+j高-i，此时碰撞体节点的中心在tile的左上角
            //将宽+0.5高-0.5，此时碰撞体节点的中心在tile的中心
            let colliderNodePosition = v3(
              (j - this.mapSize.width / 2 + 0.5) * this.tileSize.width,
              (this.mapSize.height / 2 - i - 0.5) * this.tileSize.height,
              0
            );
            colliderNode.setPosition(colliderNodePosition);
            if (this.mergeCollider) {
              //如果要合并不同图层的碰撞体，则需要在添加前判断是否重复，并且在该过程中已经完成了合并碰撞体
              if (this.mergeDifferentLayers) {
                const vertexArray = this.getColliderVertex(colliderNode);
                const isRepeatCollider = this.judgeCollider(
                  this.originalColliderNodeMapIndex,
                  vertexArray
                );
                if (isRepeatCollider) {
                  continue;
                } else {
                  this.vertexMap.set(
                    this.originalColliderNodeMapIndex,
                    vertexArray
                  );
                  this.originalColliderNodeMap.set(
                    this.originalColliderNodeMapIndex,
                    colliderNode
                  );
                  this.originalColliderNodeMapIndex++;
                  continue;
                }
              } else {
                this.originalColliderNodeMap.set(
                  this.originalColliderNodeMapIndex,
                  colliderNode
                );
                this.originalColliderNodeMapIndex++;
                continue;
              }
            } else {
              if (this.mergeDifferentLayers) {
                //此时在getMapInfo方法中已经创建了Obstacle节点，将碰撞体挂载在这个节点下
                colliderNode.setParent(this.Obstacle);
                continue;
              } else {
                //此时在getMapInfo方法中为每一个图层创建了碰撞层，将碰撞体挂载在图层自身的碰撞层下
                colliderNode.setParent(layer.node.getChildByName("Obstacle"));
                continue;
              }
            }
          }
        }
      }
    }
  }
  mergeAllColliders() {
    this.originalColliderNodeMap.forEach((colliderNode, index) => {
      const vertexArray = this.getColliderVertex(colliderNode);
      this.vertexMap.set(index, vertexArray);
      this.judgeCollider(index, vertexArray);
    });
  }
  //获取碰撞顶点
  getColliderVertex(colliderNode) {
    //创建碰撞顶点数组
    let vertexArray: Vec2[] = [];
    //获取父节点坐标
    const x = colliderNode.position.x;
    const y = colliderNode.position.y;
    //获取碰撞体组件
    const collider = colliderNode.getComponent(Collider2D);
    //获取碰撞体的偏移
    const offsetX = collider.offset.x;
    const offsetY = collider.offset.y;
    switch (collider.TYPE) {
      case ECollider2DType.None:
        return;
      case ECollider2DType.BOX:
        //获取矩形碰撞体
        const boxCollider = colliderNode.getComponent(BoxCollider2D);
        //获取碰撞体的宽高
        const width = boxCollider.size.width;
        const height = boxCollider.size.height;
        //计算顶点以碰撞层Obstacle为基准的坐标,顺序以左上角为起点逆时针绕一圈
        vertexArray = [
          v2(x - width / 2 + offsetX, y + height / 2 + offsetY),
          v2(x - width / 2 + offsetX, y - height / 2 + offsetY),
          v2(x + width / 2 + offsetX, y - height / 2 + offsetY),
          v2(x + width / 2 + offsetX, y + height / 2 + offsetY),
        ];
        break;
      case ECollider2DType.CIRCLE:
        return;
      case ECollider2DType.POLYGON:
        //获取多边形碰撞体
        const polygonCollider = colliderNode.getComponent(PolygonCollider2D);
        //计算顶点以碰撞层Obstacle为基准的坐标
        vertexArray = polygonCollider.points.map((point) =>
          v2(point.x + x + offsetX, point.y + y + offsetY)
        );
        break;
      default:
        return;
    }
    return vertexArray;
  }

  //判断当前碰撞体是否与vertexMap中已经存入的其他碰撞体有碰撞
  judgeCollider(index: number, vertexArray: Vec2[] = []) {
    //与当前碰撞体有一个点相接触的碰撞体索引数组
    const firstContactIndexArray: number[] = [];
    //与当前碰撞体至少有两个点相接触的碰撞体索引数组
    const contactIndexArray: number[] = [];
    //获取vertexArray
    if (vertexArray.length === 0) {
      vertexArray = this.vertexMap.get(index);
    }
    let isRepeatCollider = true;
    //遍历当前碰撞体的每一个顶点
    vertexArray.forEach((vertex) => {
      //将顶点Vec2转换为字符串
      const vertexStr = vertex.toString();
      //判断当前顶点是否在vertexColliderMap中
      if (this.vertexColliderMap.has(vertexStr)) {
        //判断这个顶点属于自己这个碰撞体吗，不属于才执行接下来的操作
        if (this.vertexColliderMap.get(vertexStr).indexOf(index) === -1) {
          const colliderIndexArray = this.vertexColliderMap.get(vertexStr);
          //判断是第一次接触还是二次接触
          colliderIndexArray.forEach((colliderIndex) => {
            if (firstContactIndexArray.indexOf(colliderIndex) === -1) {
              firstContactIndexArray.push(colliderIndex);
            } else {
              if (contactIndexArray.indexOf(colliderIndex) === -1) {
                contactIndexArray.push(colliderIndex);
              }
            }
          });
          //更新vertexColliderMap中当前顶点对应的碰撞体索引数组
          colliderIndexArray.push(index);
        }
      } else {
        //当前顶点没有对应的碰撞体索引数组，则创建一个数组并添加当前碰撞体的索引
        this.vertexColliderMap.set(vertexStr, [index]);
        isRepeatCollider = false;
      }
    });
    if (this.mergeCollider) {
      //当isRepeatCollider是true时进行进一步判断，若与contactIndexArray中的每个碰撞体都不同，则isRepeatCollider会变为false，否则为true
      if (isRepeatCollider) {
        for (let i = 0; i < contactIndexArray.length; i++) {
          const contactIndex = contactIndexArray[i];
          const contactVertexArray = this.vertexMap.get(contactIndex);
          //判断发生碰撞的这个碰撞体自身的顶点数组是否与目前的碰撞体完全相同
          isRepeatCollider =
            JSON.stringify(vertexArray) === JSON.stringify(contactVertexArray);
          //若相同说明发生重复碰撞，则直接退出循环
          if (isRepeatCollider) {
            isRepeatCollider = true;
            break;
          }
        }
      }
      //此时isRepeatCollider代表了真实的是否重复情况，可以根据实际情况执行不同操作
      if (isRepeatCollider) {
        //从vertexColliderMap中删除当前碰撞体每个顶点对应的自身的索引
        vertexArray.forEach((vertex) => {
          const vertexStr = vertex.toString();
          const colliderIndexArray = this.vertexColliderMap.get(vertexStr);
          if (colliderIndexArray[colliderIndexArray.length - 1] === index) {
            colliderIndexArray.pop();
          }
        });
        return true;
      } else {
        //记录当前碰撞体的一些信息
        this.mainColliderIndexMap.set(index, index);
        this.mainColliderWithOthersIndexMap.set(index, [index]);
        //这里需要创建一个深拷贝，因为需要保留vertexArray的原始信息
        const newVertexArray = vertexArray.map(
          (vec) => new math.Vec2(vec.x, vec.y)
        );
        this.polygonPointsMap.set(index, newVertexArray);
        //如果当前碰撞体与其他碰撞体有碰撞，则合并两个碰撞体
        if (contactIndexArray.length > 0) {
          //将当前碰撞体接触的第一个碰撞体作为主碰撞体
          const toCombineIndex = contactIndexArray[0];
          this.combineCollider(toCombineIndex, index);
          //后续的碰撞体都添加到主碰撞体上
          if (contactIndexArray.length > 1) {
            for (let i = 1; i < contactIndexArray.length; i++) {
              this.combineCollider(toCombineIndex, contactIndexArray[i]);
            }
          }
        }
        return false;
      }
    }
    //记录当前碰撞体的一些信息
    this.mainColliderIndexMap.set(index, index);
    this.mainColliderWithOthersIndexMap.set(index, [index]);
    //这里需要创建一个深拷贝，因为需要保留vertexArray的原始信息
    const newVertexArray = vertexArray.map(
      (vec) => new math.Vec2(vec.x, vec.y)
    );
    this.polygonPointsMap.set(index, newVertexArray);
    //如果当前碰撞体与其他碰撞体有碰撞，则合并两个碰撞体
    if (contactIndexArray.length > 0) {
      //将当前碰撞体接触的第一个碰撞体作为主碰撞体
      const toCombineIndex = contactIndexArray[0];
      this.combineCollider(toCombineIndex, index);
      //后续的碰撞体都添加到主碰撞体上
      if (contactIndexArray.length > 1) {
        for (let i = 1; i < contactIndexArray.length; i++) {
          this.combineCollider(toCombineIndex, contactIndexArray[i]);
        }
      }
    }
  }
  //合并碰撞体（若没有公共边则不会合并）
  combineCollider(
    toCombineIndex: number,
    viceCombineIndex: number,
    contactVertexArray: Vec2[] = []
  ) {
    let tempMainIndex = this.mainColliderIndexMap.get(toCombineIndex);
    let tempViceCombineIndex = this.mainColliderIndexMap.get(viceCombineIndex);
    let mainIndex = tempMainIndex;
    let viceIndex = tempViceCombineIndex;
    //通过循环查找到复合碰撞体最初的碰撞体，这个碰撞体就是主碰撞体
    if (tempMainIndex !== undefined) {
      let count = 0;
      do {
        tempMainIndex = mainIndex;
        mainIndex = this.mainColliderIndexMap.get(mainIndex);
        count++;
        if (count > 100) {
          console.error(
            "查询mainIndex循环次数过多，请检查碰撞体索引是否有误,mainIndex",
            mainIndex,
            "tempMainIndex",
            tempMainIndex
          );
          return;
        }
      } while (mainIndex !== tempMainIndex);
    } else {
      //正常情况下不会发生
      console.error("主碰撞体索引未找到,正常情况下不会发生", toCombineIndex);
      this.mainColliderIndexMap.set(toCombineIndex, toCombineIndex);
      this.mainColliderWithOthersIndexMap.set(toCombineIndex, [toCombineIndex]);
      mainIndex = toCombineIndex;
    }
    //判断副碰撞体是否已经合并过
    if (
      tempViceCombineIndex === undefined ||
      tempViceCombineIndex === viceCombineIndex
    ) {
      //如果副碰撞体与主碰撞体相同,则直接返回
      if (mainIndex === viceCombineIndex) {
        return;
      }
      //副碰撞体没有合并过，则直接将副碰撞体的索引改为主碰撞体的索引
      this.mainColliderIndexMap.set(viceCombineIndex, mainIndex);
      const mainIndexArray = this.mainColliderWithOthersIndexMap.get(mainIndex);
      mainIndexArray.push(viceCombineIndex);
      this.mainColliderWithOthersIndexMap.set(mainIndex, mainIndexArray);
      viceIndex = viceCombineIndex;
    } else {
      //找出副碰撞体合并的主碰撞体
      let count = 0;
      do {
        tempViceCombineIndex = viceIndex;
        viceIndex = this.mainColliderIndexMap.get(viceIndex);
        count++;
        if (count > 100) {
          console.error(
            "查询viceIndex循环次数过多，请检查碰撞体索引是否有误,viceIndex",
            viceIndex,
            "tempViceCombineIndex",
            tempViceCombineIndex
          );
          return;
        }
      } while (viceIndex !== tempViceCombineIndex);
      //如果副碰撞体的主碰撞体与要合并的碰撞体的主碰撞体相同，则直接返回
      if (viceIndex === mainIndex) {
        return;
      } else {
        //否则就判断谁来当主碰撞体
        let viceIndexArray = this.mainColliderWithOthersIndexMap.get(viceIndex);
        let mainIndexArray = this.mainColliderWithOthersIndexMap.get(mainIndex);
        //判断主副碰撞体包含碰撞体的个数，谁多谁当主碰撞体
        if (viceIndexArray.length > mainIndexArray.length) {
          //将原主碰撞体的索引改为原副碰撞体的索引
          this.mainColliderIndexMap.set(mainIndex, viceIndex);
          //将原主碰撞体包含的所有碰撞体加入原副碰撞体
          viceIndexArray.concat(mainIndexArray);
          //删除重复的索引
          const finalViceIndexArray = [...new Set(viceIndexArray)];
          this.mainColliderWithOthersIndexMap.set(
            viceIndex,
            finalViceIndexArray
          );
          //交换主副碰撞体索引
          const temp = viceIndex;
          viceIndex = mainIndex;
          mainIndex = temp;
        } else {
          //将副碰撞体的索引改为主碰撞体的索引
          this.mainColliderIndexMap.set(viceIndex, mainIndex);
          //将副碰撞体包含的所有碰撞体加入主碰撞体，按设计来说不会有重复的碰撞体
          mainIndexArray.concat(viceIndexArray);
          const finalMainIndexArray = [...new Set(mainIndexArray)];
          this.mainColliderWithOthersIndexMap.set(
            mainIndex,
            finalMainIndexArray
          );
        }
      }
    }
    let mainVertexArray: Vec2[] = [];
    let viceVertexArray: Vec2[] = [];
    //获取主副碰撞体的顶点数组
    if (this.polygonPointsMap.has(mainIndex)) {
      const OriginalMainVertexArray = this.polygonPointsMap.get(mainIndex);
      mainVertexArray = OriginalMainVertexArray.map(
        (vec) => new math.Vec2(vec.x, vec.y)
      );
    } else {
      console.error("主碰撞体顶点数组未找到,正常情况下不会发生", mainIndex);
    }
    //获取副碰撞体的顶点数组
    if (this.polygonPointsMap.has(viceIndex)) {
      viceVertexArray = this.polygonPointsMap.get(viceIndex);
    } else {
      console.error("副碰撞体顶点数组未找到,正常情况下不会发生", viceIndex);
    }
    //创建碰撞点数组构成的表用于快速查找(一个点坐标可能对应了多个点，因此会有多个)
    const mainVertexArrayMap: Map<string, number[]> = new Map();
    const viceVertexArrayMap: Map<string, number[]> = new Map();
    this.vertexToIndex(mainVertexArray, mainVertexArrayMap);
    this.vertexToIndex(viceVertexArray, viceVertexArrayMap);
    //如果contactVertexArray没有值，则获取主副碰撞体发生碰撞的顶点为之赋值
    if (contactVertexArray.length === 0) {
      viceVertexArray.forEach((vertex) => {
        const vertexStr = vertex.toString();
        const mainColliderVertexIndex = mainVertexArrayMap.get(vertexStr);
        if (mainColliderVertexIndex !== undefined) {
          contactVertexArray.push(vertex);
        }
      });
    }
    //如果contactVertexArray只有一个点或没有点，则说明没有公共边，撤回之前的操作，返回
    if (contactVertexArray.length === 0 || contactVertexArray.length === 1) {
      this.unDoCombine(mainIndex, viceIndex);
      return;
    }
    //将contactVertexArray转换为Map便于查找
    const contactVertexArrayMap: Map<string, Vec2> = new Map();
    contactVertexArray.forEach((vertex) => {
      const vertexStr = vertex.toString();
      contactVertexArrayMap.set(vertexStr, vertex);
    });
    //遍历mainVertexArray,将第一个非碰撞点作为新的数组的第一个点
    for (let i = 0; i < mainVertexArray.length; i++) {
      const vertexStr = mainVertexArray[i].toString();
      if (contactVertexArrayMap.has(vertexStr)) {
        continue;
      }
      if (i === 0) {
        break;
      }
      const cutVertexArray = mainVertexArray.splice(
        i,
        mainVertexArray.length - i
      );
      mainVertexArray = cutVertexArray.concat(mainVertexArray);
      //清除之前的mainVertexArrayMap并用调整后的数组更新它
      mainVertexArrayMap.clear();
      this.vertexToIndex(mainVertexArray, mainVertexArrayMap);
      break;
    }
    //获取共点在主副碰撞体中的索引
    let CommonEdgeVertexInMainAndViceIndex =
      this.findCommonEdgeVertexInMainAndViceIndex(
        contactVertexArray,
        mainVertexArrayMap,
        mainVertexArray,
        viceVertexArrayMap,
        viceVertexArray
      );
    let commonEdgeFirstVertexInMainIndex: number;
    let commonEdgeFirstVertexInViceIndex: number;
    if (CommonEdgeVertexInMainAndViceIndex) {
      commonEdgeFirstVertexInMainIndex = CommonEdgeVertexInMainAndViceIndex[0];
      commonEdgeFirstVertexInViceIndex = CommonEdgeVertexInMainAndViceIndex[1];
    } else {
      //没有公共边，撤销合并
      this.unDoCombine(mainIndex, viceIndex);
      return;
    }
    //副碰撞体以共点为起始点调整后的顶点数组
    let newViceVertexArray: Vec2[] = [];
    if (
      commonEdgeFirstVertexInMainIndex === undefined ||
      commonEdgeFirstVertexInMainIndex === null
    ) {
      console.error("没有共点，正常运行不该发生这种情况，请调试查看报错");
      return;
    } else {
      if (commonEdgeFirstVertexInViceIndex === 0) {
        //如果共点是副碰撞体的第一个点，则副碰撞体的顶点数组不做调整
        newViceVertexArray = viceVertexArray;
      } else {
        //如果有公共边，就将共点作为副碰撞体的新起始点
        const cutVertexArray = viceVertexArray.splice(
          commonEdgeFirstVertexInViceIndex,
          viceVertexArray.length - commonEdgeFirstVertexInViceIndex
        );
        newViceVertexArray = cutVertexArray.concat(viceVertexArray);
      }
      //如果共点是主碰撞体的尾点,就将主碰撞体的第二个点作为起始点
      if (commonEdgeFirstVertexInMainIndex === mainVertexArray.length - 1) {
        const cutVertexArray = mainVertexArray.splice(
          1,
          mainVertexArray.length - 1
        );
        mainVertexArray = cutVertexArray.concat(mainVertexArray);
      }
      //将新的副碰撞体顶点数组插入到主碰撞体数组的切入点左边
      mainVertexArray.splice(
        commonEdgeFirstVertexInMainIndex,
        0,
        ...newViceVertexArray
      );
      //新的多边形碰撞体的顶点数组
      let newPointsArray: Vec2[] = [];
      newPointsArray.push(mainVertexArray[0]);
      for (let i = 1; i < mainVertexArray.length; i++) {
        const lastPoint = newPointsArray[newPointsArray.length - 1];
        //如果当前顶点和上一个顶点相同，则跳过
        if (mainVertexArray[i].equals(lastPoint)) {
          continue;
        }
        //当前点与上上个点相同，就不添加该点且删除上个点
        if (newPointsArray.length > 1) {
          const lastSecondPoint = newPointsArray[newPointsArray.length - 2];
          if (mainVertexArray[i].equals(lastSecondPoint)) {
            newPointsArray.pop();
            continue;
          }
        }
        newPointsArray.push(mainVertexArray[i]);
      }
      this.polygonPointsMap.set(mainIndex, newPointsArray);
      //删除原副碰撞体的多边形碰撞体顶点数组,即使表中不存在viceIndex也没关系
      this.polygonPointsMap.delete(viceIndex);
    }
  }
  //撤销合并过程中的操作(重新设置副碰撞体在mainColliderIndexMap中的索引，删除主碰撞体在mainColliderWithOthersIndexMap中多出的viceIndexArray元素)
  unDoCombine(mainIndex: number, viceIndex: number) {
    this.mainColliderIndexMap.set(viceIndex, viceIndex);
    let viceIndexArray = this.mainColliderWithOthersIndexMap.get(viceIndex);
    if (!viceIndexArray) {
      viceIndexArray = [viceIndex];
    }
    const mainIndexArray = this.mainColliderWithOthersIndexMap.get(mainIndex);
    const viceIndexArrayLength = viceIndexArray.length;
    //将mainIndexArray末尾的viceIndexArray元素删除
    mainIndexArray.splice(-viceIndexArrayLength, viceIndexArrayLength);
  }
  //寻找第一条公共边的第一个顶点（简称共点）在主碰撞体中的索引，以及该点在副碰撞体中的索引，相邻的两个碰撞点在主副碰撞体中都相邻，这两个点组成的边就是公共边，若无公共边则返回undefined
  findCommonEdgeVertexInMainAndViceIndex(
    contactVertexArray,
    mainVertexArrayMap,
    mainVertexArray,
    viceVertexArrayMap,
    viceVertexArray
  ): number[] {
    let commonEdgeFirstVertexInMainIndex: number = null;
    let commonEdgeFirstVertexInViceIndex: number = null;
    //碰撞点在主碰撞体中的索引数组
    const contactVertexIndexArray: number[][] = [];
    //获取到每个碰撞点在主碰撞体中的索引
    for (let i = 0; i < contactVertexArray.length; i++) {
      const vertexStr = contactVertexArray[i].toString();
      const mainColliderVertexIndex = mainVertexArrayMap.get(vertexStr);
      if (mainColliderVertexIndex === undefined) {
        console.error(
          "碰撞点",
          vertexStr,
          "不在主碰撞体中,请查看MapController.ts中的寻找共点的方法"
        );
      } else {
        contactVertexIndexArray.push(mainColliderVertexIndex);
      }
    }
    //依据该索引重新构建一个索引数组
    let contactVertexInMainIndex = [];
    for (let i = 0; i < contactVertexIndexArray.length; i++) {
      const indexArray = contactVertexIndexArray[i];
      for (let j = 0; j < indexArray.length; j++) {
        if (contactVertexInMainIndex.indexOf(indexArray[j]) === -1) {
          contactVertexInMainIndex.push(indexArray[j]);
        }
      }
    }
    //冒泡排序，将contactVertexInMainIndex中的索引按照从小到大的顺序排序
    for (let i = 0; i < contactVertexInMainIndex.length - 1; i++) {
      let isSorted = true;
      for (let j = 0; j < contactVertexInMainIndex.length - i - 1; j++) {
        if (contactVertexInMainIndex[j] > contactVertexInMainIndex[j + 1]) {
          const temp = contactVertexInMainIndex[j];
          contactVertexInMainIndex[j] = contactVertexInMainIndex[j + 1];
          contactVertexInMainIndex[j + 1] = temp;
          isSorted = false;
        }
      }
      if (isSorted) {
        break;
      }
    }
    for (let i = 0; i < contactVertexInMainIndex.length; i++) {
      let mainVertexIndex1: number = null;
      let mainVertexIndex2: number = null;
      //根据i是不是最后一个点进行赋值,确保（在逆时针顺序下）当公共边存在时，mainVertexIndex1一定是共点
      if (i != contactVertexInMainIndex.length - 1) {
        mainVertexIndex1 = contactVertexInMainIndex[i];
        mainVertexIndex2 = contactVertexInMainIndex[i + 1];
      } else {
        mainVertexIndex1 =
          contactVertexInMainIndex[contactVertexInMainIndex.length - 1];
        mainVertexIndex2 = contactVertexInMainIndex[0];
      }
      //两点在主碰撞体中是否相邻(注意点是有序排列后的，因此要启用有序判断模式
      const isMainAdjacent = this.isVertexAdjacent(
        mainVertexIndex1,
        mainVertexIndex2,
        mainVertexArray.length,
        true
      );
      if (isMainAdjacent) {
        //通过点在主碰撞体的索引，查询到点的坐标
        const VertexStr1 = mainVertexArray[mainVertexIndex1].toString();
        const VertexStr2 = mainVertexArray[mainVertexIndex2].toString();
        //通过点的坐标获取到该点在副碰撞体顶点数组中的索引数组，此时若共点存在，则一定是viceVertexIndexArray1中的点
        const viceVertexIndexArray1 = viceVertexArrayMap.get(
          VertexStr1.toString()
        );
        const viceVertexIndexArray2 = viceVertexArrayMap.get(
          VertexStr2.toString()
        );
        //通过两两组合尝试出所有顶点组合的可能性，只要有一种顶点组合是相邻的，就满足公共边条件
        for (let j = 0; j < viceVertexIndexArray1.length; j++) {
          for (let k = 0; k < viceVertexIndexArray2.length; k++) {
            //判断两点在副碰撞体中是否相邻
            const isViceAdjacent = this.isVertexAdjacent(
              viceVertexIndexArray1[j],
              viceVertexIndexArray2[k],
              viceVertexArray.length
            );
            if (isViceAdjacent) {
              commonEdgeFirstVertexInMainIndex = mainVertexIndex1;
              commonEdgeFirstVertexInViceIndex = viceVertexIndexArray1[j];
              return [
                commonEdgeFirstVertexInMainIndex,
                commonEdgeFirstVertexInViceIndex,
              ];
            }
          }
        }
      }
    }
    //如果进行到这一步还没有找到公共边，就说明有碰撞点但没公共边，返回null
    return null;
  }
  vertexToIndex(array, map) {
    array.forEach((vertex, index) => {
      const vertexStr = vertex.toString();
      if (map.has(vertexStr)) {
        const indexArray = map.get(vertexStr);
        indexArray.push(index);
        map.set(vertexStr, indexArray);
      } else {
        map.set(vertexStr, [index]);
      }
    });
  }
  //根据两点在多边形中的索引以及多边形数组长度，判断这两点是否相邻
  isVertexAdjacent(
    vertexIndex1: number,
    vertexIndex2: number,
    ArrayLength: number,
    isSorted: boolean = false
  ): boolean {
    if (isSorted) {
      const result =
        vertexIndex1 + 1 === vertexIndex2 ||
        (vertexIndex1 === ArrayLength - 1 && vertexIndex2 === 0);
      return result;
    } else {
      const result =
        vertexIndex1 + 1 === vertexIndex2 ||
        (vertexIndex1 === 0 && vertexIndex2 === ArrayLength - 1) ||
        vertexIndex2 + 1 === vertexIndex1 ||
        (vertexIndex2 === 0 && vertexIndex1 === ArrayLength - 1);
      return result;
    }
  }
  optimizeAllPolygonPoints() {
    this.polygonPointsMap.forEach((points, index) => {
      this.optimizeOnePolygonPoints(points, index);
    });
  }
  //进一步处理多边形碰撞体数组，
  optimizeOnePolygonPoints(points: Vec2[], index: number) {
    if (points.length < 3) {
      console.error("多边形碰撞体顶点数少于3，请检查数据");
      return;
    } else if (points.length === 3) {
      return;
    }
    let goOn = true;
    let count = 0;
    let advancedPoints = [];
    if (this.advancedOptimize) {
      //持续优化，直到数组不再变化
      while (goOn) {
        count++;
        if (count > 10) {
          break;
        }
        //创建顶点坐标到索引的映射表，方便查找
        const PointToIndexMap: Map<String, number[]> = new Map();
        //创建新的顶点坐标到索引的映射表，用于存储优化后的顶点坐标与索引
        const newPointToIndexMap: Map<String, number[]> = new Map();
        //创建重复点的数组
        const repeatPointStrArray: string[] = [];
        //创建重复点的索引数组
        const repeatPointIndexArray: number[] = [];
        //遍历所有顶点，得到上述表与数组的信息
        points.forEach((point, pointIndex) => {
          const pointStr = point.toString();
          if (PointToIndexMap.has(pointStr)) {
            repeatPointStrArray.push(pointStr);
            const indexArray = PointToIndexMap.get(pointStr);
            if (indexArray.length === 1) {
              repeatPointIndexArray.push(indexArray[0]);
            }
            repeatPointIndexArray.push(pointIndex);
            indexArray.push(pointIndex);
            //深拷贝该点的索引数组，避免修改原数组
            const newIndexArray = [...indexArray];
            newPointToIndexMap.set(pointStr, newIndexArray);
          } else {
            PointToIndexMap.set(pointStr, [pointIndex]);
            newPointToIndexMap.set(pointStr, [pointIndex]);
          }
        });

        let pointIndex = 0;
        while (pointIndex < points.length) {
          if (repeatPointIndexArray.indexOf(pointIndex) === -1) {
            advancedPoints.push(points[pointIndex]);
            pointIndex++;
            continue;
          } else {
            //如果当前点是重复点，则判断该点所有索引的下一个索引点是否是单点，找到第一个单点，选择对应该点的当前index索引，若都是重复点，则默认选择当前index索引

            //最后一个点没有下一个点，默认添加
            if (pointIndex === points.length - 1) {
              advancedPoints.push(points[pointIndex]);
              break;
            }
            //判断当前索引的下一个索引点是不是单点
            const nextIndex = pointIndex + 1;
            if (repeatPointIndexArray.indexOf(nextIndex) !== -1) {
              //如果不是单点，就判断该点是不是镂空点
              //仅适用于最简单的镂空情况，即镂空部分的重复边上的每个点都仅重复一次
              let isHole;
              //当前点的坐标
              const currentPointStr = points[pointIndex].toString();
              //当前点的索引数组
              const currentIndexArray = newPointToIndexMap.get(currentPointStr);
              //当前索引在该点索引数组中的位次（从小到大的第几个）
              const pointIndexInArray = currentIndexArray.indexOf(pointIndex);
              let repeatPointIndexInArray;
              if (pointIndexInArray === currentIndexArray.length - 1) {
                repeatPointIndexInArray = 0;
              } else {
                repeatPointIndexInArray = pointIndexInArray + 1;
              }
              //当前点的索引数组的下一个索引
              const repeatPointIndexInPointArray =
                currentIndexArray[repeatPointIndexInArray];
              //下一个索引点的索引数组的下一个索引
              const nextPointStr = points[nextIndex].toString();
              const OriginalNextIndexArray = PointToIndexMap.get(nextPointStr);
              const OriginalNextIndexArrayLength =
                OriginalNextIndexArray.length;
              //若下一个索引点是单点或有两个以上重复点，则不是镂空点，否则执行以下操作
              if (OriginalNextIndexArrayLength === 2) {
                const nextIndexArray = newPointToIndexMap.get(nextPointStr);
                const nextPointIndexInArray = nextIndexArray.indexOf(nextIndex);
                let nextRepeatPointIndexInArray;
                if (nextPointIndexInArray === nextIndexArray.length - 1) {
                  nextRepeatPointIndexInArray = 0;
                } else {
                  nextRepeatPointIndexInArray = nextPointIndexInArray + 1;
                }
                //下一个索引点的索引数组的下一个索引
                const nextRepeatPointIndexInPointArray =
                  nextIndexArray[nextRepeatPointIndexInArray];
                //如果这两点是重复且逆向，就进入判断镂空的循环
                if (
                  nextRepeatPointIndexInPointArray + 1 ===
                  repeatPointIndexInPointArray
                ) {
                  let tempIndex = pointIndex + 1;
                  while (true) {
                    //找出当前点的索引数组的下一个索引
                    const tempPointStr = points[tempIndex].toString();
                    const tempPointIndexArray =
                      newPointToIndexMap.get(tempPointStr);
                    const tempPointIndexInArray =
                      tempPointIndexArray.indexOf(tempIndex);
                    let tempRepeatPointIndexInArray;
                    if (
                      tempPointIndexInArray ===
                      tempPointIndexArray.length - 1
                    ) {
                      tempRepeatPointIndexInArray = 0;
                    } else {
                      tempRepeatPointIndexInArray = tempPointIndexInArray + 1;
                    }
                    const tempRepeatPointIndexInPointArray =
                      tempPointIndexArray[tempRepeatPointIndexInArray];
                    //找出下一个索引点的索引数组的下一个索引
                    const tempNextIndex = tempIndex + 1;
                    const tempNextPointStr = points[tempNextIndex].toString();
                    const originalTempNextIndexArray =
                      PointToIndexMap.get(tempNextPointStr);
                    const originalTempNextIndexArrayLength =
                      originalTempNextIndexArray.length;
                    //索引点有两个以上重复点，则不是镂空点
                    if (originalTempNextIndexArray.length > 2) {
                      isHole = false;
                      break;
                    } else if (originalTempNextIndexArrayLength === 1) {
                      isHole = true;
                      break;
                    } else {
                      const tempNextIndexArray =
                        newPointToIndexMap.get(tempNextPointStr);
                      const tempNextPointIndexInArray =
                        tempNextIndexArray.indexOf(tempNextIndex);
                      let tempNextRepeatPointIndexInArray;
                      if (
                        tempNextPointIndexInArray ===
                        tempNextIndexArray.length - 1
                      ) {
                        tempNextRepeatPointIndexInArray = 0;
                      } else {
                        tempNextRepeatPointIndexInArray =
                          tempNextPointIndexInArray + 1;
                      }
                      const tempNextRepeatPointIndexInPointArray =
                        tempNextIndexArray[tempNextRepeatPointIndexInArray];
                      //如果这两点是重复且逆向，就继续下个点的判定，直到不是重复边时退出循环
                      if (
                        tempNextRepeatPointIndexInPointArray + 1 ===
                        tempRepeatPointIndexInPointArray
                      ) {
                        tempIndex++;
                        continue;
                      } else {
                        isHole = true;
                        break;
                      }
                    }
                  }
                } else {
                  //否则就不是镂空点
                  isHole = false;
                }
              } else {
                isHole = false;
              }

              //如果是镂空点就选择该点,否则判断当前点的其他索引的下一个索引点是否是单点
              if (!isHole) {
                let hasFound = false;
                //当前点的坐标
                const currentPointStr = points[pointIndex].toString();
                //当前点的索引数组
                const currentIndexArray =
                  newPointToIndexMap.get(currentPointStr);
                //当前索引在该点索引数组中的位次（从小到大的第几个）
                const pointIndexInArray = currentIndexArray.indexOf(pointIndex);
                let repeatPointIndexInArray;
                if (pointIndexInArray === currentIndexArray.length - 1) {
                  repeatPointIndexInArray = 0;
                } else {
                  repeatPointIndexInArray = pointIndexInArray + 1;
                }
                for (
                  let i = repeatPointIndexInArray;
                  i < currentIndexArray.length;
                  i++
                ) {
                  const tempIndex = currentIndexArray[i];
                  const tempNextIndex = tempIndex + 1;
                  if (repeatPointIndexArray.indexOf(tempNextIndex) === -1) {
                    pointIndex = tempIndex;
                    hasFound = true;
                    break;
                  }
                }
                if (!hasFound) {
                  if (
                    repeatPointIndexInArray !== 0 ||
                    repeatPointIndexInArray !== 1
                  ) {
                    for (let i = 0; i < pointIndexInArray; i++) {
                      const tempIndex = currentIndexArray[i];
                      const tempNextIndex = tempIndex + 1;
                      if (repeatPointIndexArray.indexOf(tempNextIndex) === -1) {
                        pointIndex = tempIndex;
                        hasFound = true;
                        break;
                      }
                    }
                  }
                }
              }
            }
            advancedPoints.push(points[pointIndex]);
            //删除重复点中的当前索引,防止后续被重复添加
            const pointStr = points[pointIndex].toString();
            const indexArray = newPointToIndexMap.get(pointStr);
            indexArray.splice(indexArray.indexOf(pointIndex), 1);
            pointIndex++;
            continue;
          }
        }
        const notChange =
          JSON.stringify(advancedPoints) === JSON.stringify(points);
        if (notChange) {
          goOn = false;
        } else {
          points = advancedPoints;
          advancedPoints = [];
        }
      }
    } else {
      advancedPoints = points;
    }
    //删除同一条直线上无用的点
    let newPoints = [advancedPoints[0], advancedPoints[1]];
    for (let i = 2; i < advancedPoints.length; i++) {
      //获取三个点
      const point = advancedPoints[i];
      const lastPoint = newPoints[newPoints.length - 1];
      const lastSecondPoint = newPoints[newPoints.length - 2];
      // //判断三点是否在同一条直线上
      if (this.isPointsOnSameStraightLine(point, lastPoint, lastSecondPoint)) {
        newPoints.pop();
      }
      newPoints.push(point);
    }
    // 对于advancedPoints的最后一个点，如果和起始点与倒数第二个点在同一条直线上，就删除最后一个点
    const theLastPoint = advancedPoints[advancedPoints.length - 1];
    const theSecondLastPoint = newPoints[newPoints.length - 2];
    const firstPoint = newPoints[0];
    if (
      this.isPointsOnSameStraightLine(
        theLastPoint,
        firstPoint,
        theSecondLastPoint
      )
    ) {
      newPoints.pop();
    }
    //如果最后一个点和优化后数组中的第一个点以及第二个点在同一条直线上，就删除第一个点
    const secondPoint = newPoints[1];
    if (
      this.isPointsOnSameStraightLine(theLastPoint, firstPoint, secondPoint)
    ) {
      newPoints.shift();
    }
    //如果最后一个点和第一个点相同，就删除最后一个点
    if (theLastPoint.equals(firstPoint)) {
      newPoints.pop();
    }
    //更新多边形碰撞体顶点数组
    this.optimizePolygonPointsMap.set(index, newPoints);
  }

  //将多边形碰撞体添加到地图的Obstacle节点下
  addColliderToMap() {
    // for (const [mainIndex, points] of this.polygonPointsMap) {
    for (const [mainIndex, points] of this.optimizePolygonPointsMap) {
      const node = new Node();
      node.setParent(this.Obstacle);
      node.addComponent(PolygonCollider2D);
      const polygonCollider = node.getComponent(PolygonCollider2D);
      polygonCollider.group = this.colliderGroup;
      polygonCollider.points = points;
    }
    //如果没有重启这一步则位置会错乱
    this.Obstacle.active = false;
    this.Obstacle.active = true;
  }
  //添加对象碰撞
  addColliderToObject(objectLayers: TiledObjectGroup[]) {
    if (!objectLayers) {
      return;
    }
    objectLayers.forEach((objectLayer) => {
      const name = objectLayer.name;
      const objects = objectLayer.getObjects();
      objects.forEach((obj) => {
        const node = new Node();
        node.setParent(this.node.getChildByName("name"));
        node.setPosition(v3(obj.x - 184, obj.y - 320, 0));
        // 根据对象类型创建不同的碰撞体
        switch (obj.type) {
          /*
                    - 0：点/矩形
                    - 1：椭圆
                    - 2：多边形
                    - 3：模板？（）
                    - 4：图块
                    - 5：文字
                    */
          case 3:
          case 4:
          case 0:
            node.addComponent(BoxCollider2D);
            const boxCollider = node.getComponent(BoxCollider2D);
            boxCollider.size = size(obj.width, obj.height);
            boxCollider.offset = v2(obj.width / 2, obj.height / 2);
            break;
          case 5:
            node.addComponent(BoxCollider2D);
            const boxCollider0 = node.getComponent(BoxCollider2D);
            boxCollider0.size = size(obj.width, obj.height);
            boxCollider0.offset = v2(obj.width / 2, -obj.height / 2);
            break;
          case 1:
            node.addComponent(CircleCollider2D);
            const circleCollider = node.getComponent(CircleCollider2D);
            circleCollider.radius = Math.max(obj.width / 2, obj.height / 2);
            break;
          case 2:
            node.addComponent(PolygonCollider2D);
            const polylineCollider = node.getComponent(PolygonCollider2D);
            const polylinePoints = obj.points.map((point) =>
              v2(point.x, point.y)
            );
            polylineCollider.points = polylinePoints;
            break;
          default:
            break;
        }
        const collider = node.getComponent(Collider2D);
        collider.group = this.colliderGroup;
        collider.apply();
      });
    });
  }
  getCollider(grid) {
    const name = this.GridToName.get(grid);
    return GridColliderMap[name];
  }
  isPointsOnSameStraightLine(paramA: Vec2, paramB: Vec2, paramC: Vec2) {
    const A = paramA.clone();
    const B = paramB.clone();
    const C = paramC.clone();
    const AB = B.subtract(A);
    const AC = C.subtract(A);
    const cross = AB.cross(AC);
    if (Math.abs(cross) < math.EPSILON) {
      if (cross !== 0) {
        console.log("Math.abs(cross)", Math.abs(cross));
      }
      return true;
    } else {
      return false;
    }
  }
}
