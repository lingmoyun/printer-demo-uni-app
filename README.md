# Printer Demo
[![License](https://img.shields.io/badge/license-MIT-4EB1BA.svg)](https://www.opensource.org/licenses/mit-license.php)

零墨云旗下打印机Demo（uni-app版本）

### 示例

| 通讯方式      | 发现打印机 | 打印示例 | 备注    |
|-----------|:-----:|:----:|-------|
| Bluetooth |   ✓   |  ✓   | BLE模式 |

#### 集成步骤

* 复制文件夹 [printerdemo](./printerdemo) 到你项目中的根目录下

* 在项目 `pages.json` 文件中添加页面路径

```json
{
  "pages": [
    ...,
    // BLE Demo
    {
      "path": "printerdemo/pages/ble/index",
      "style": {
        "navigationBarTitleText": "BLE Demo"
      }
    },
    ...
  ]
}

```


## 零墨云旗下打印机Demo汇总

- [printer-demo][1]

[1]: https://github.com/lingmoyun/printer-demo

