import type { Device } from '@/types/device'
import type { MockType } from '@/types/mock'


export const devices: Device[] = createDevicesData(60)

// [
//     {
//         id: '1',
//         name: 'Lamp A',
//         workshopId: 'A2',
//         status: 'online',
//         brightness: 80,
//         temperature: 36.5,
//         version: 1,
//         updatedAt: new Date().toISOString()
//     },
//     {
//         id: '2',
//         name: 'Lamp B',
//         workshopId: 'A3',
//         status: 'offline',
//         brightness: 0,
//         temperature: 25.2,
//         version: 1,
//         updatedAt: new Date().toISOString()
//     }
// ]

function getRandomArbitrary(min: number, max: number): number {
    return Number((Math.random() * (max - min) + min).toFixed(1));
}

function getRandomIntInclusive(min: number, max: number): number {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
}

function createDevicesData(quantity: number): Device[] {
    console.log('--');

    const device: Device[] = []
    for (let i = 0; i < quantity; i++) {
        const random = {
            name: getRandomIntInclusive(0, 100),
            workshopId: getRandomIntInclusive(0, 100),
            status: getRandomIntInclusive(0, 100),
            brightness: getRandomIntInclusive(0, 100),
            temperature: getRandomArbitrary(30, 50),
            version: getRandomIntInclusive(0, 5),
        }
        device.push({
            id: String(i + 1),
            name: `Lamp ${random.name > 50 ? 'A' : 'B'}`,
            workshopId: `${random.workshopId > 50 ? 'A' : 'B'}${getRandomIntInclusive(0, 100) > 50 ? '1' : '2'}`,
            status: `${random.status > 30 ? 'online' : random.status > 60 ? 'offline' : 'error'}`,
            brightness: random.brightness,
            temperature: random.temperature,
            version: random.version,
            updatedAt: new Date(Date.now() - getRandomIntInclusive(0, 100000)).toISOString()
        })
    }
    return device
}

console.log(devices, "dev");

const deviceRequest: MockType[] = [
    {
        url: '/api/devices',
        method: 'get',
        response: (request: any) => {
            console.log(request, "request");

            const query = request.query ?? {}
            const page = Number(query.page || 1)
            const pageSize = Number(query.pageSize || 20)
            const params = {
                id: query.id,
                name: query.name,
                workshopId: query.workshopId,
                status: query.status,
                brightness: query.brightness,
                temperature: query.temperature,
                version: query.version,
                updatedAt: query.updatedAt
            }
            let result = devices
            if (Object.keys(query).length > 0) {
                Object.keys(params).forEach((key) => {
                    const value = params[key as keyof typeof params]
                    if (value === undefined || value === null || value === '') {
                        return
                    }
                    switch (key) {
                        case 'id':
                            result = result.filter(item => item.id.toLowerCase().includes(value.toLowerCase()))
                            break
                        case 'name':
                            result = result.filter(item => item.name.toLowerCase().includes(value.toLowerCase()))
                            break
                        case 'workshopId':
                            result = result.filter(item => item.workshopId.toLowerCase().includes(value.toLowerCase()))
                            break
                        case 'status':
                            result = result.filter(item => item.status.toLowerCase().includes(value.toLowerCase()))
                            break
                        case 'brightness':
                            result = result.filter(item => item.brightness === Number(value))
                            break
                        case 'temperature':
                            result = result.filter(item => item.temperature === Number(value))
                            break
                        case 'version':
                            result = result.filter(item => item.version === Number(value))
                            break
                        case 'updatedAt':
                            result = result.filter(item => item.updatedAt.toLowerCase().includes(value.toLowerCase()))
                            break
                        default:
                            break
                    }
                })
            }

            const start = (page - 1) * pageSize
            const end = start + pageSize
            const total = result.length
            // const randomFault = Math.floor(Math.random() * 100) > 50 ? true : false
            // if (!randomFault) {
                // return {
                //     code: 400,
                //     data: {
                //     }
                // }
            //     return {
            //         code: 200,
            //         data: {
            //             code: 200,
            //             message: 'hi',
            //             data: {
            //                 list: [],
            //                 page,
            //                 pageSize,
            //                 total: 0
            //             }
            //         }

            //     }
            // }
            return {
                code: 200,
                data: {
                    code: 200,
                    message: 'hi',
                    data: {
                        list: result.slice(start, end),
                        page,
                        pageSize,
                        total
                    }
                }
            }
        },
    }
]


export default deviceRequest