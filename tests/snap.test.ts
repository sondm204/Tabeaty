import { describe, expect, it } from 'vitest'
import { snapPosition, snapResize, viewportCenter, viewportGuides } from '../src/snap'

const area = { width: 1000, height: 800 }
const size = { width: 200, height: 150 }
const neighbor = { x: 280, y: 210, width: 310, height: 230 }

describe('Căn chỉnh ghi chú', () => {
  it('căn cạnh với ghi chú khác trên hai trục độc lập', () => {
    expect(snapPosition({ x: 275, y: 214 }, size, area, [neighbor])).toEqual({
      position: { x: 280, y: 210 },
      guides: { x: 280, y: 210 },
    })
  })

  it('căn tâm các ghi chú có kích thước khác nhau', () => {
    expect(snapPosition({ x: 339, y: 245 }, size, area, [neighbor])).toEqual({
      position: { x: 335, y: 250 },
      guides: { x: 435, y: 325 },
    })
  })

  it('căn mép và tâm vùng ghi chú khi không có hàng xóm', () => {
    expect(snapPosition({ x: 6, y: 329 }, size, area, [])).toEqual({
      position: { x: 0, y: 325 },
      guides: { x: 0, y: 400 },
    })
  })

  it('giữ tọa độ tự do khi không có mục tiêu đủ gần', () => {
    const point = { x: 35, y: 40 }
    expect(snapPosition(point, size, area, [neighbor])).toEqual({
      position: point,
      guides: { x: undefined, y: undefined },
    })
  })

  it('bỏ qua mục tiêu gần hơn nếu việc căn chỉnh sẽ đẩy ghi chú ra ngoài', () => {
    const nearEdge = { x: 590, y: 50, width: 212, height: 150 }
    const point = { x: 796, y: 310 }
    const result = snapPosition(point, size, area, [nearEdge])
    expect(result.position.x).toBe(800)
    expect(result.position.x + size.width).toBeLessThanOrEqual(area.width)
  })
})

describe('Căn theo tâm trình duyệt', () => {
  const origin = { x: 40, y: 85 }
  const frame = { width: 1200, height: 699 }
  const center = viewportCenter(origin, { width: 1280, height: 900 })

  it('căn hai tâm theo khung trình duyệt dù vùng kéo có lề lệch nhau', () => {
    const snapped = snapPosition({ x: 502, y: 294 }, size, frame, [], center)
    expect(snapped.position).toEqual({ x: 500, y: 290 })
    expect(viewportGuides(snapped.guides, origin)).toEqual({ x: 640, y: 450 })
  })

  it('không hút cạnh vật thể vào đường tâm khi tâm vật thể nằm xa', () => {
    const raw = { x: 603, y: 35 }
    expect(snapPosition(raw, size, frame, [], center)).toEqual({
      position: raw, guides: { x: undefined, y: undefined },
    })
  })

  it('khi kéo cạnh ghi chú thì chỉnh kích thước để tâm nằm giữa và giữ cạnh còn lại', () => {
    const raw = { x: 410, y: 240, width: 376, height: 250 }
    const snapped = snapResize(raw, frame, [], 'right', center)
    expect(snapped.rect).toEqual({ ...raw, width: 380 })
    expect(viewportGuides(snapped.guides, origin)).toEqual({ x: 640, y: undefined })
  })
})

describe('Căn chỉnh khi đổi kích thước', () => {
  it('căn hai cạnh đang kéo và giữ các cạnh đối diện', () => {
    const raw = { x: 80, y: 40, width: 196, height: 174 }
    expect(snapResize(raw, area, [neighbor], 'bottomRight')).toEqual({
      rect: { x: 80, y: 40, width: 200, height: 170 },
      guides: { x: 280, y: 210 },
    })
  })

  it('căn tâm theo một trục khi kéo cạnh trái', () => {
    const target = { x: 200, y: 530, width: 200, height: 160 }
    const raw = { x: 96, y: 175, width: 404, height: 190 }
    expect(snapResize(raw, area, [target], 'left')).toEqual({
      rect: { x: 100, y: 175, width: 400, height: 190 },
      guides: { x: 300, y: undefined },
    })
  })

  it('giữ kích thước hợp lệ khi cạnh đích quá gần cạnh cố định', () => {
    const target = { x: 296, y: 600, width: 200, height: 150 }
    const raw = { x: 100, y: 170, width: 205, height: 160 }
    expect(snapResize(raw, area, [target], 'right').rect).toEqual(raw)
  })
})
