'use strict';

/**
 * 支付宝SDK封装
 * 基于 alipay-sdk v4，使用 curl() 方法调用 v3 协议接口
 * 提供支付宝当面付相关操作的统一入口
 */

const { AlipaySdk } = require('alipay-sdk');
const fs = require('fs');

/* SDK单例缓存 */
let _sdkInstance = null;

/**
 * 获取支付宝SDK单例实例（证书模式 RSA2）
 * @param {object} config - 支付宝配置 (app.config.alipay)
 * @returns {AlipaySdk}
 */
function getSdkInstance(config) {
  if (!_sdkInstance) {
    _sdkInstance = new AlipaySdk({
      appId: config.appId,
      privateKey: config.privateKey,
      signType: config.signType || 'RSA2',
      /* 证书模式：传入证书文件内容 */
      appCertContent: fs.readFileSync(config.appCertPath, 'utf-8'),
      alipayPublicCertContent: fs.readFileSync(config.alipayPublicCertPath, 'utf-8'),
      alipayRootCertContent: fs.readFileSync(config.alipayRootCertPath, 'utf-8'),
      /* v4 SDK 使用 endpoint 属性替代旧版 gateway */
      endpoint: config.gateway || 'https://openapi.alipay.com',
    });
    console.log('[支付宝SDK] 证书模式初始化完成, appId:', config.appId, ', endpoint:', config.gateway || 'https://openapi.alipay.com');
  }
  return _sdkInstance;
}

/**
 * 当面付 - 预创建订单（获取二维码URL）
 *
 * alipay-sdk v4 curl() 返回格式：
 * 成功: { data: { qr_code, out_trade_no }, responseHttpStatus: 200, traceId: 'xxx' }
 * 失败: 抛出异常或 { data: { code, msg, sub_code, sub_msg }, responseHttpStatus: 4xx }
 *
 * @param {object} config - 支付宝配置
 * @param {object} params - 订单参数
 * @param {string} params.outTradeNo - 商户订单号
 * @param {string} params.totalAmount - 订单金额
 * @param {string} params.subject - 订单标题
 * @returns {Promise<object>} 包含 qrCode 的响应数据
 */
async function precreate(config, params) {
  const sdk = getSdkInstance(config);

  console.log('[支付宝预创建] 请求参数:', JSON.stringify({
    out_trade_no: params.outTradeNo,
    total_amount: params.totalAmount,
    subject: params.subject,
  }));

  const result = await sdk.curl('POST', '/v3/alipay/trade/precreate', {
    body: {
      out_trade_no: params.outTradeNo,
      total_amount: params.totalAmount,
      subject: params.subject,
      notify_url: params.notifyUrl || config.notifyUrl,
    },
  });

  console.log('[支付宝预创建] 原始响应:', JSON.stringify(result));

  /*
   * v4 SDK curl() 返回结构：{ data, responseHttpStatus, traceId }
   * data 中包含实际的业务数据（已自动 camelCase 转换）
   * 需要从 data 中提取 qrCode (即 qr_code 的驼峰形式)
   */
  const responseData = result.data || result;

  /* 检查是否有错误码（支付宝业务错误） */
  if (responseData.code && responseData.code !== '10000') {
    const errMsg = `支付宝业务错误: [${responseData.code}] ${responseData.msg || ''} - ${responseData.subCode || responseData.sub_code || ''}: ${responseData.subMsg || responseData.sub_msg || ''}`;
    console.error('[支付宝预创建]', errMsg);
    throw new Error(errMsg);
  }

  /* 提取二维码URL，兼容驼峰和下划线两种格式 */
  const qrCode = responseData.qrCode || responseData.qr_code || '';

  if (!qrCode) {
    console.error('[支付宝预创建] 未返回二维码URL, responseData:', JSON.stringify(responseData));
  }

  return {
    qrCode,
    outTradeNo: responseData.outTradeNo || responseData.out_trade_no || params.outTradeNo,
    responseHttpStatus: result.responseHttpStatus,
    traceId: result.traceId,
  };
}

/**
 * 查询交易状态
 *
 * @param {object} config - 支付宝配置
 * @param {string} outTradeNo - 商户订单号
 * @returns {Promise<object>} 交易状态信息
 */
async function queryTrade(config, outTradeNo) {
  const sdk = getSdkInstance(config);

  const result = await sdk.curl('POST', '/v3/alipay/trade/query', {
    body: {
      out_trade_no: outTradeNo,
    },
  });

  // console.log('[支付宝查询] 原始响应:', JSON.stringify(result));

  /* 从 data 中提取交易信息 */
  const responseData = result.data || result;

  return {
    tradeStatus: responseData.tradeStatus || responseData.trade_status,
    tradeNo: responseData.tradeNo || responseData.trade_no,
    outTradeNo: responseData.outTradeNo || responseData.out_trade_no,
    totalAmount: responseData.totalAmount || responseData.total_amount,
    buyerLogonId: responseData.buyerLogonId || responseData.buyer_logon_id,
  };
}

/**
 * 验证异步通知签名
 * @param {object} config - 支付宝配置
 * @param {object} postData - 回调POST数据
 * @returns {boolean} 验签结果
 */
function checkNotifySign(config, postData) {
  const sdk = getSdkInstance(config);
  return sdk.checkNotifySignV2(postData);
}

/**
 * 电脑网站支付 - 生成支付表单HTML
 *
 * alipay-sdk v4 pageExecute() 返回格式：
 * 返回一个HTML表单字符串，前端直接渲染或提交即可跳转到支付宝收银台
 *
 * @param {object} config - 支付宝配置
 * @param {object} params - 订单参数
 * @param {string} params.outTradeNo - 商户订单号
 * @param {string} params.totalAmount - 订单金额
 * @param {string} params.subject - 订单标题
 * @param {string} [params.body] - 商品描述（显示在支付宝订单详情中）
 * @param {string} params.returnUrl - 同步回调地址（支付完成后跳转）
 * @returns {Promise<string>} 支付表单HTML
 */
async function pagePay(config, params) {
  const sdk = getSdkInstance(config);

  console.log('[支付宝电脑网站支付] 请求参数:', JSON.stringify({
    out_trade_no: params.outTradeNo,
    total_amount: params.totalAmount,
    subject: params.subject,
  }));

  const formHtml = await sdk.pageExec('alipay.trade.page.pay', {
    bizContent: {
      out_trade_no: params.outTradeNo,
      total_amount: params.totalAmount,
      subject: params.subject,
      body: params.body || '',
      product_code: 'FAST_INSTANT_TRADE_PAY',
    },
    returnUrl: params.returnUrl || config.returnUrl,
    notifyUrl: params.notifyUrl || config.notifyUrl,
  });

  console.log('[支付宝电脑网站支付] 表单生成成功');

  return formHtml;
}

module.exports = {
  getSdkInstance,
  pagePay,
  queryTrade,
  checkNotifySign,
};
