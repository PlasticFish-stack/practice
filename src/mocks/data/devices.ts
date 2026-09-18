import type { Device } from '@/types/device'
import type { MockType } from '@/types/mock'

export const devices: Device[] = [
    {
        id: '1',
        name: 'Lamp A',
        workshopId: 'A2',
        status: 'online',
        brightness: 80,
        temperature: 36.5,
        version: 1,
        updatedAt: new Date().toISOString()
    },
    {
        id: '2',
        name: 'Lamp B',
        workshopId: 'A3',
        status: 'offline',
        brightness: 0,
        temperature: 25.2,
        version: 1,
        updatedAt: new Date().toISOString()
    }
]

const deviceRequest: MockType[] = [
    {
        url: '/api/devices',
        method: 'get',
        response: (request: any) => {
            console.log(request, "request");
            
            const query = request.query ?? {}
            const page = Number(query.page || 1)
            const pageSize = Number(query.pageSize || 20)
            const keyword = query.keyword || ''
            const status = query.status

            let result = devices
            if (keyword) {
                result = result.filter(item => item.name.toLowerCase().includes(keyword.toLowerCase()))
            }
            if (status) {
                result = result.filter(item => item.status === status)
            }
            const start = (page - 1) * pageSize
            const end = start + pageSize
            return {
                code: 200,
                data: {
                    code: 200,
                    message: 'hi',
                    data: {
                        list: result.slice(start, end),
                        page,
                        pageSize,
                        total: result.length
                    }
                }
            }
        },
    }
]


export default deviceRequest