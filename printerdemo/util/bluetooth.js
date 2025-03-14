/*!
 * Create by Winford
 */

// var HEX = require('./HEX.min.js');

// 初始化蓝牙
const _openBluetoothAdapter = () => {
    return new Promise(function (resolve, reject) {
        uni.closeBluetoothAdapter({
            fail: reject,
            complete() {
                // 初始化蓝牙
                uni.openBluetoothAdapter({
                    success: resolve,
                    fail: reject
                })
            }
        })
        // // 初始化蓝牙
        // uni.openBluetoothAdapter({
        // 	success: resolve,
        // 	fail: reject
        // })
    });
}

// 蓝牙建立连接
const _createBLEConnection = (deviceId) => {
    // 连接BLE
    return new Promise(function (resolve, reject) {
        uni.createBLEConnection({
            deviceId,
            success: resolve,
            fail: reject
        })
    });
}

const _getBLEDeviceServices = (deviceId) => {
    // 获取服务
    return new Promise(function (resolve, reject) {
        uni.getBLEDeviceServices({
            deviceId,
            success: (res) => {
                for (let i = 0; i < res.services.length; i++) {
                    let service = res.services[i];
                    if (service.uuid.startsWith('0000FF00')) {
                        resolve(service);
                        return;
                    }
                }
                resolve();
                //resolve(await _getBLEDeviceServices(deviceId))
            },
            fail: reject
            // fail: function(e) {
            // 	console.log(e);
            // }
        })
    });
}

const _getBLEDeviceCharacteristics = (deviceId, serviceId) => {
    // 获取读写特征值
    return new Promise(function (resolve, reject) {
        uni.getBLEDeviceCharacteristics({
            deviceId,
            serviceId,
            success: (res) => {
                let characteristics = {};
                for (let i = 0; i < res.characteristics.length; i++) {
                    let item = res.characteristics[i];
                    // console.log(item);
                    if (item.properties.notify) {
                        characteristics.notify = characteristics.notify || item;
                    }

                    if (item.properties.write) {
                        characteristics.write = characteristics.write || item;
                    }

                    if (item.uuid.startsWith('0000FF03')) {
                        characteristics.dataFC = characteristics.dataFC || item;
                    }
                }
                resolve(characteristics);
            },
            fail: reject
        });
    });
}

// 写数据
const _wxWriteBLECharacteristicValue = ({
                                            deviceId,
                                            serviceId,
                                            characteristicId,
                                            value
                                        }) => {
    return new Promise(function (resolve, reject) {
        uni.writeBLECharacteristicValue({
            deviceId,
            serviceId,
            characteristicId,
            value,
            writeType: 'writeNoResponse',
            //writeType: 'write',
            success: function () {
                resolve(true);
            },
            fail: function (e) {
                console.log(e);
                if (e.code == 10007) {
                    // uniapp bug, retry.
                    resolve(false);
                } else {
                    reject(e)
                }
            }
        });
    });
}

const sleep = (time) => new Promise((resolve, reject) => setTimeout(resolve, time));

// 写数据
const _writeBLECharacteristicValue = async (deviceId, serviceId, characteristicId, value, mtu = 20) => {
    const total = value.byteLength;
    console.log("================mtu=" + mtu, new Date())
    let num = 0;
    let count = 0;
    while (count < total) {
        const element = value.slice(count, count + mtu); // 取出MTU个数据
        if (element.byteLength === 0) break; // 表示已经发送完毕

        // #ifdef APP-PLUS
        // await sleep(50);
        let writeResult = await _wxWriteBLECharacteristicValue({
            deviceId,
            serviceId,
            characteristicId,
            value: element
        });
        if (writeResult) {
            count = count + element.byteLength;
            num++;
        }
        // #endif

        // #ifdef MP-WEIXIN
        // num % 100 == 0 && await sleep(100);
        _wxWriteBLECharacteristicValue({
            deviceId,
            serviceId,
            characteristicId,
            value: element
        });
        count = count + element.byteLength;
        num++;
        // #endif
        // console.log("================count=" + count)
        // console.log("================num=" + num)
    }
    console.log("================num=" + num, new Date())

}

// 写数据
const _writeBLECharacteristicValueWithDataFC = async (device, value) => {
    // const data = value.slice(); // copy一份，浅拷贝
    const total = value.byteLength;
    console.log('total--->', total);
    let num = 0;
    let count = 0;
    const dataFC = device.dataFC;
    while (count < total) {
        if (dataFC.mtu > 0 && dataFC.credit > 0) {
            const subData = value.slice(count, count + dataFC.mtu - 3); // 取出MTU-3个数据
            if (subData.byteLength === 0) break; // 表示已经发送完毕
            count = count + subData.byteLength;

            dataFC.credit--;
            // #ifdef APP-PLUS
            while (!(await _wxWriteBLECharacteristicValue({
                deviceId: device.deviceId,
                serviceId: device.serviceId,
                characteristicId: device.writeCharacteristicId,
                value: subData,
            }))) {
                await sleep(100); // I don't know why, but uni-app is shit, okay
                console.log('写入失败，正在重新写入。。。');
            }
            // #endif
            // #ifndef APP-PLUS
            _wxWriteBLECharacteristicValue({
                deviceId: device.deviceId,
                serviceId: device.serviceId,
                characteristicId: device.writeCharacteristicId,
                value: subData,
            });
            // #endif
            num++;
        } else {
            // 令牌用尽，等待令牌
            await sleep(0);
            // console.log('令牌用尽，等待令牌');
        }
    }
    console.log('num--->', num);
}

// 协商MTU
const _setBLEMTU = (deviceId, mtu) => {
	return new Promise(function (resolve, reject) {
        uni.setBLEMTU({
            deviceId: deviceId,
            mtu: mtu,
            success(res) {
                console.log('setBLEMTU success', res);
                resolve(true);
            },
            fail(res) {
                console.log('setBLEMTU fail', res);
                if (res.errCode === -1 && res.errno === 1500104) {
                    // uniapp bug, retry.
                    resolve(false);
                } else {
                    reject(res);
                }
            },
        });
	});
}

// 发现设备
const find = (onBluetoothDeviceFound) => {
    _openBluetoothAdapter().then(function (res) {
        // 添加监听
        uni.onBluetoothDeviceFound(function (res) {
            if (onBluetoothDeviceFound) {
                onBluetoothDeviceFound(res);
            }
        });
        uni.startBluetoothDevicesDiscovery();
    })
}

// 连接
const connect = async ({
                           deviceId,
                           onBLEConnectionStateChange,
                           onBLECharacteristicValueChange,
                           onDataFCValueChange,
                       }) => {
    let device = {
        connected: false,
        deviceId: deviceId,
        serviceId: '',
        notifyCharacteristicId: '',
        writeCharacteristicId: '',
        dataFCCharacteristicId: '',
        onBLEConnectionStateChange,
        onBLECharacteristicValueChange,
        onDataFCValueChange,
        dataFC: {
            mtu: 0,
            credit: 0,
        },
    };

    // 请求蓝牙权限
    await _openBluetoothAdapter().then(function (res) {
        return new Promise((resolve, reject) => {
            // 添加监听
            uni.onBLEConnectionStateChange(function (res) {
                // 该方法回调中可以用于处理连接意外断开等异常情况
                device.connected = res.connected;
                if (device.onBLEConnectionStateChange) {
                    device.onBLEConnectionStateChange(res);
                }
                if (res.connected) {
                    resolve(res);
                } else {
                    reject(res);
                }
            });
            // 连接BLE
            _createBLEConnection(deviceId);
        });

        // 添加监听
        // uni.onBLEConnectionStateChange(function(res) {
        // 	// 该方法回调中可以用于处理连接意外断开等异常情况
        // 	device.connected = res.connected;
        // 	if (device.onBLEConnectionStateChange) {
        // 		device.onBLEConnectionStateChange(res);
        // 	}
        // });
        // // 连接BLE
        // return _createBLEConnection(deviceId);
    }).then(async function (res) {
        // 获取服务
        await sleep(1000);
        let service = await _getBLEDeviceServices(deviceId);
        if (!service) {
            // 有时候获取不到，尝试重新获取
            await sleep(2000);
            service = await _getBLEDeviceServices(deviceId);
        }
        if (!service) {
            Promise.reject('获取service失败');
        } else {
            return service;
        }
    }).then(function (service) {
        // 获取读写特征值
        console.log('获取读写特征值')
        device.serviceId = service.uuid;
        return _getBLEDeviceCharacteristics(device.deviceId, device.serviceId);
    }).then(function (characteristics) {
        // 读
        device.notifyCharacteristicId = characteristics.notify ? characteristics.notify.uuid : '';
        // 写
        device.writeCharacteristicId = characteristics.write ? characteristics.write.uuid : '';
        // 流控
        device.dataFCCharacteristicId = characteristics.dataFC ? characteristics.dataFC.uuid : '';
    }).catch(function (err) {
        console.log(err);
    });

    // device.mtu = 20;
    if (uni.getSystemInfoSync().platform === 'android') {
        await new Promise(function (resolve, reject) {
            uni.setBLEMTU({
                deviceId: deviceId,
                mtu: 512,
                success(res) {
                    // device.mtu = res.mtu;
                    console.log('setBLEMTU success', res);
                    // resolve(res);
                },
                fail(res) {
                    console.log('setBLEMTU fail', res);
                    // reject(res);
                },
                complete() {
                    resolve();
                }
            });
        });
        // #ifdef APP-PLUS
        await sleep(500); // I don't know why, but uni-app is shit, okay
        // #endif
    }
	// if (uni.getSystemInfoSync().platform === 'android') {
    //     // uni-app bug，在部分Android手机上，setBLEMTU会失败，需要多次尝试
    //     for (let i = 0; i < 3; i++) {
    //         if (await _setBLEMTU(deviceId, 512)) {
    //             break;
    //         }
    //         await sleep(1000);
    //     }
	//     // #ifdef APP-PLUS
	//     await sleep(500); // I don't know why, but uni-app is shit, okay
	//     // #endif
	// }

    console.log('onBLECharacteristicValueChange')
    // 监听
    uni.onBLECharacteristicValueChange(function (res) {
        // 读监听
        if (res.characteristicId === device.notifyCharacteristicId) {
            device.onBLECharacteristicValueChange && device.onBLECharacteristicValueChange(res);
        }
        // 流控监听
        if (res.characteristicId === device.dataFCCharacteristicId) {
            const data = new Uint8Array(res.value);
            const flag = data[0];
            if (flag === 1) {
                device.dataFC.credit += data[1];
                // console.log('===流控更新，credit', data[1]);
            } else if (flag === 2) {
                device.dataFC.mtu = (data[2] << 8) + data[1]; // 低位在前，高位在后
                // console.log('===流控更新，mtu', device.dataFC.mtu);
            }
            device.onDataFCValueChange && device.onDataFCValueChange(res);
        }
    });

    // 读监听
    if (device.notifyCharacteristicId) {
        console.log('notifyBLECharacteristicValueChange: ' + device.notifyCharacteristicId)
        await new Promise(function (resolve, reject) {
            uni.notifyBLECharacteristicValueChange({
                state: true, // 启用 notify 功能
                // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
                deviceId: device.deviceId,
                // 这里的 serviceId 需要在 getBLEDeviceServices 接口中获取
                serviceId: device.serviceId,
                // 这里的 characteristicId 需要在 getBLEDeviceCharacteristics 接口中获取
                characteristicId: device.notifyCharacteristicId,
                success: resolve,
                fail: reject
            });
        });
    }
    // 流控监听
    if (device.dataFCCharacteristicId) {
        // #ifdef APP-PLUS
        await sleep(500); // I don't know why, but uni-app is shit, okay
        // #endif
        console.log('notifyBLECharacteristicValueChange: ' + device.dataFCCharacteristicId)
        await new Promise(function (resolve, reject) {
            uni.notifyBLECharacteristicValueChange({
                state: true, // 启用 notify 功能
                // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
                deviceId: device.deviceId,
                // 这里的 serviceId 需要在 getBLEDeviceServices 接口中获取
                serviceId: device.serviceId,
                // 这里的 characteristicId 需要在 getBLEDeviceCharacteristics 接口中获取
                characteristicId: device.dataFCCharacteristicId,
                success: resolve,
                fail: reject
            });
        });
    }

    // 写方法
    // device.write = async (value, {
    // 	mtu = 20
    // }) => {
    // 	// console.log(device.deviceId, 'write', HEX.ab2hex(value));
    // 	if (device.writeCharacteristicId) {
    // 		await _writeBLECharacteristicValue(device.deviceId, device.serviceId, device
    // 			.writeCharacteristicId, value, mtu);
    // 	}
    // };

    // 流控写方法(传输速度提升6倍)
    device.write = async (value) => {
        // console.log(device.deviceId, 'writeWithDataFC', HEX.ab2hex(value));
        if (device.writeCharacteristicId && device.dataFCCharacteristicId) {
            await _writeBLECharacteristicValueWithDataFC(device, value);
        }
    };

    // 断开连接
    device.close = () => {
        uni.closeBLEConnection({
            deviceId: device.deviceId
        })
    };

    console.log(device);
    return device;
}


module.exports = {
    find,
    connect
}
