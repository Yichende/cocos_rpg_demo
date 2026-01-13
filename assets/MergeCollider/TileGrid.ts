//碰撞的类型
export enum ColliderType {
    Full = "Full",
    Left = "Left",
    Right = "Right",
    Down = "Down",
    LeftDown = "LeftDown",
    RightDown = "RightDown",
    LeftDownCor = "LeftDownCor",
    RightDownCor = "RightDownCor"
}
//根据grid获取到碰撞类型
export const GridColliderMap = {
    "Wall_Left": ColliderType.Left,
    "Wall_Up": ColliderType.Full,
    "Wall_Right": ColliderType.Right,
    "Wall_Down": ColliderType.Down,
    "Wall_LeftDown": ColliderType.LeftDown,
    "Wall_RightDown": ColliderType.RightDown,
    "Wall_LeftDownCor": ColliderType.LeftDownCor,
    "Wall_RightDownCor": ColliderType.RightDownCor
}