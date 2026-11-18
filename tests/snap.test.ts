import { describe, expect, it } from 'vitest'
import { snapNote } from '../src/snap'

const area = { width: 1000, height: 800 }
const size = { width: 200, height: 150 }
const neighbor = { x: 280, y: 210, width: 310, height: 230 }

describe('Căn chỉnh ghi chú', () => {
  it('căn cạnh với ghi chú khác trên hai trục độc lập', () => {
    expect(snapNote({ x: 275, y: 214 }, size, area, [neighbor])).toEqual({
      position: { x: 280, y: 210 },
      guides: { x: 280, y: 210 },
    })
  })

  it('căn tâm các ghi chú có kích thước khác nhau', () => {
    expect(snapNote({ x: 339, y: 245 }, size, area, [neighbor])).toEqual({
      position: { x: 335, y: 250 },
      guides: { x: 435, y: 325 },
    })
  })

  it('căn mép và tâm vùng ghi chú khi không có hàng xóm', () => {
    expect(snapNote({ x: 6, y: 329 }, size, area, [])).toEqual({
      position: { x: 0, y: 325 },
      guides: { x: 0, y: 400 },
    })
  })

  it('giữ tọa độ tự do khi không có mục tiêu đủ gần', () => {
    const point = { x: 35, y: 40 }
    expect(snapNote(point, size, area, [neighbor])).toEqual({
      position: point,
      guides: { x: undefined, y: undefined },
    })
  })

  it('bỏ qua mục tiêu gần hơn nếu việc căn chỉnh sẽ đẩy ghi chú ra ngoài', () => {
    const nearEdge = { x: 590, y: 50, width: 212, height: 150 }
    const point = { x: 796, y: 310 }
    const result = snapNote(point, size, area, [nearEdge])
    expect(result.position.x).toBe(800)
    expect(result.position.x + size.width).toBeLessThanOrEqual(area.width)
  })
})
