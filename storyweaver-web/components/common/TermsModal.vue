<template>
  <Teleport to="body">
    <Transition name="terms-fade">
      <div v-if="visible" class="terms-overlay" @click.self="handleClose">
        <Transition name="terms-slide">
          <div v-if="visible" class="terms-dialog">
            <!-- 标题栏 -->
            <div class="terms-dialog__header">
              <h3 class="terms-dialog__title">知剧AI服务条款</h3>
              <button class="terms-dialog__close" @click="handleClose">
                <Icon name="lucide:x" size="20" />
              </button>
            </div>

            <!-- 条款内容（可滚动） -->
            <div class="terms-dialog__content">
              <section class="terms-section">
                <h4 class="terms-section__title">一、协议主体与接受</h4>
                <p class="terms-section__text">
                  知剧AI，是由溢彩视觉（北京）科技发展有限公司（以下简称"本公司"、"我们"）向用户提供的AI短剧创作平台及相关服务。
                </p>
                <p class="terms-section__text">
                  您确认：您已经通过知剧AI平台，按照服务协议的规定注册成为知剧AI的用户（以下简称"用户"）。本服务条款（及本服务条款的不时更新）由您和本公司签订，适用于您与我们的交易（以下简称为"商业交易"），包括您向我们购买会员服务以及后续提供的各项付费服务（以下简称为"付费服务"）。
                </p>
                <p class="terms-section__text">
                  您确认：当您开始实际使用知剧AI的任意一项付费服务时，视为您已同意本服务条款。
                </p>
              </section>

              <section class="terms-section">
                <h4 class="terms-section__title">二、用户确认事项</h4>
                <p class="terms-section__subtitle">2.1 年龄确认</p>
                <p class="terms-section__text">
                  您确认：您已满18周岁或以上，完全有能力同意本服务条款。如果您未满18周岁，您将不能使用知剧AI的付费服务。
                </p>
                <p class="terms-section__subtitle">2.2 条款接受</p>
                <p class="terms-section__text">
                  您在与我们进行商业交易之前，已经充分阅读、理解并接受本服务条款的全部内容，点击"付款"、"我同意"、"续费"、"开通会员"等按钮或其他类似按钮，即表示您同意受本服务条款的约束。
                </p>
                <p class="terms-section__subtitle">2.3 服务更新</p>
                <p class="terms-section__text">
                  为改善用户体验，本公司保留随时更新或更改知剧AI平台及服务的权利。此类更新将根据我们当时的政策提供，其中可能包括自动更新或升级，而无需另行通知您。您同意对服务进行任何此类自动更新或升级。
                </p>
                <p class="terms-section__subtitle">2.4 使用授权</p>
                <p class="terms-section__text">
                  本公司授予您合法使用知剧AI的个人的、有限的、可撤销的、不可转让的、非排他性的权利。本协议未明确授权的所有其他权利仍归本公司所有。
                </p>
                <p class="terms-section__subtitle">2.5 账号安全</p>
                <p class="terms-section__text">
                  您的账号仅限您本人使用，您应自行妥善保管、使用、维护您付费服务的账号、账号信息及密码，并采取必要和有效的保密措施，不得与他人分享账号及相关服务信息。账号共享可能会引发账号风险等级提高，从而导致账号被系统永久封停，无法解封。
                </p>
              </section>

              <section class="terms-section">
                <h4 class="terms-section__title">三、费用与支付</h4>
                <p class="terms-section__subtitle">3.1 付费方式</p>
                <p class="terms-section__text">
                  知剧AI为付费平台，您可以通过以下方式获取付费服务：<br>
                  1. 购买知剧AI会员服务<br>
                  2. 其他后续推出的付费项目
                </p>
                <p class="terms-section__subtitle">3.2 支付处理</p>
                <p class="terms-section__text">
                  您的付款将通过第三方支付服务商进行处理，此类支付可能存在适用的附加条款。
                </p>
                <p class="terms-section__subtitle">3.3 价格变更</p>
                <p class="terms-section__text">
                  本公司保留修改知剧AI服务定价的权利。此类通知会在知剧AI平台上发布或通过站内消息、邮件等方式告知您。如果您不同意支付新的价格，您可以选择不再继续购买会员服务。
                </p>
              </section>

              <section class="terms-section">
                <h4 class="terms-section__title">四、退款政策</h4>
                <p class="terms-section__subtitle">4.1 虚拟商品特殊性说明</p>
                <p class="terms-section__text">
                  本平台提供的会员服务属于虚拟商品，一经购买并开通使用，即视为服务已交付完成。根据《消费者权益保护法》第二十五条，虚拟商品不适用七天无理由退货规定。
                </p>
                <p class="terms-section__subtitle">4.2 不予退款的情形</p>
                <p class="terms-section__text">
                  用户购买会员后，除以下特殊情况外，原则上不予退款：<br>
                  1. 会员服务已开通并开始计时<br>
                  2. 用户已使用会员权益（如生成剧本、使用AI功能等）<br>
                  3. 用户已开始实际享受已购付费服务
                </p>
                <p class="terms-section__subtitle">4.3 可申请退款的情形</p>
                <p class="terms-section__text">
                  以下情况用户可申请退款，我们将在核实后处理：<br>
                  1. <strong>平台责任</strong>：因平台技术故障导致服务无法正常使用超过24小时<br>
                  2. <strong>重复支付</strong>：因系统错误导致重复扣款<br>
                  3. <strong>未成年人充值</strong>：监护人提供有效证明材料，我们将在核实后7个工作日内全额退款<br>
                  4. <strong>欺诈或虚假宣传</strong>：平台存在明显欺诈行为
                </p>
                <p class="terms-section__subtitle">4.4 退款申请方式</p>
                <p class="terms-section__text">
                  如您符合上述可退款情形，请通过以下方式联系我们：<br>
                  客服邮箱：zhijuu@163.com
                </p>
              </section>

              <section class="terms-section">
                <h4 class="terms-section__title">五、服务的中断和终止</h4>
                <p class="terms-section__text">
                  本协议将一直有效，直至您或本公司终止。我们可能出于任何原因（包括但不限于您违反本服务条款）立即终止或暂停您的账户，而无需事先通知或承担任何责任。除非另有规定或适用法律另有要求，否则服务终止将不会导致任何退款。
                </p>
              </section>

              <section class="terms-section">
                <h4 class="terms-section__title">六、免责声明与责任限制</h4>
                <p class="terms-section__text">
                  我们将通过保密协议保障您在使用知剧AI过程中的信息安全。您理解并同意，知剧AI平台及相关服务是本公司在现有技术和条件范围内提供的。本公司将尽最大努力向您提供稳定、安全的服务。
                </p>
                <p class="terms-section__text">
                  您理解本公司不能随时预见和防范技术风险或其他风险，包括但不限于不可抗力、网络原因、病毒、木马、黑客攻击、系统不稳定、政府行为、第三方服务瑕疵等原因可能导致的服务中断、数据丢失等情况。
                </p>
                <p class="terms-section__text">
                  在法律允许的范围内，本公司对以下情形导致的服务中断或受阻不承担责任：<br>
                  1. 受到计算机病毒、木马或其他恶意程序、黑客攻击的破坏<br>
                  2. 用户或公司的电脑软件、系统、硬件和通信线路出现故障<br>
                  3. 用户操作不当或用户通过非公司授权的方式使用本服务<br>
                  4. 其他本公司无法控制或合理预见的情形
                </p>
              </section>

              <section class="terms-section">
                <h4 class="terms-section__title">七、争议处理</h4>
                <p class="terms-section__text">
                  本协议的成立、生效、履行、解释及争议的解决均应适用中华人民共和国法律。若您就本服务条款的内容或其执行有任何异议，您可以通过平台客服系统或发送邮件到 zhijuu@163.com 向我们提出。
                </p>
                <p class="terms-section__text">
                  若您与我们发生任何争议，双方应尽量友好协商解决；协商不成时，您和我们一致同意交由北京市朝阳区人民法院通过诉讼解决。
                </p>
              </section>

              <section class="terms-section">
                <h4 class="terms-section__title">八、联系我们</h4>
                <p class="terms-section__text">
                  如您对本服务条款有任何疑问或需要帮助，请通过以下方式联系我们：<br>
                  客服邮箱：zhijuu@163.com<br>
                  公司名称：溢彩视觉（北京）科技发展有限公司
                </p>
              </section>

              <div class="terms-footer">
                <p class="terms-footer__text">
                  <Icon name="lucide:alert-triangle" size="16" style="vertical-align: middle; margin-right: 4px;" />
                  特别提示：请您在购买前仔细阅读本服务条款，一旦购买成功，即表示您已充分了解并同意本服务条款的全部内容。
                </p>
              </div>
            </div>

            <!-- 底部按钮 -->
            <div class="terms-dialog__footer">
              <button class="terms-dialog__button" @click="handleClose">我已阅读</button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}>()

const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}
</script>

<style scoped>
/* 蒙层 */
.terms-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

/* 弹窗主体 */
.terms-dialog {
  background: #fff;
  border-radius: 16px;
  width: 680px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

/* 头部 */
.terms-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.terms-dialog__title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.terms-dialog__close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  flex-shrink: 0;
}

.terms-dialog__close:hover {
  background: #f5f5f5;
  color: #333;
}

/* 内容区域（可滚动） */
.terms-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px;
}

/* 自定义滚动条 */
.terms-dialog__content::-webkit-scrollbar {
  width: 6px;
}

.terms-dialog__content::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

.terms-dialog__content::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.terms-dialog__content::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* 条款章节 */
.terms-section {
  margin-bottom: 28px;
}

.terms-section:last-child {
  margin-bottom: 0;
}

.terms-section__title {
  font-size: 17px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 14px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #edebeb;
}

.terms-section__subtitle {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 16px 0 8px 0;
}

.terms-section__text {
  font-size: 14px;
  line-height: 1.8;
  color: #555;
  margin: 0 0 12px 0;
}

.terms-section__text:last-child {
  margin-bottom: 0;
}

.terms-section__text strong {
  color: #1677ff;
  font-weight: 600;
}

/* 底部提示 */
.terms-footer {
  margin-top: 24px;
  padding: 16px;
  background: #fef3c7;
  border-radius: 8px;
  border-left: 4px solid #f59e0b;
}

.terms-footer__text {
  font-size: 13px;
  line-height: 1.6;
  color: #92400e;
  margin: 0;
}

/* 底部按钮 */
.terms-dialog__footer {
  padding: 20px 28px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.terms-dialog__button {
  padding: 12px 48px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.terms-dialog__button:hover {
  background: linear-gradient(135deg, #0958d9 0%, #003eb3 100%);
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.3);
  transform: translateY(-1px);
}

.terms-dialog__button:active {
  transform: translateY(0);
}

/* 动画 */
.terms-fade-enter-active,
.terms-fade-leave-active {
  transition: opacity 0.25s ease;
}

.terms-fade-enter-from,
.terms-fade-leave-to {
  opacity: 0;
}

.terms-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.terms-slide-leave-active {
  transition: all 0.2s ease-in;
}

.terms-slide-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.terms-slide-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

/* 响应式 */
@media (max-width: 768px) {
  .terms-dialog {
    width: 92vw;
    max-height: 90vh;
  }

  .terms-dialog__header {
    padding: 20px 20px;
  }

  .terms-dialog__title {
    font-size: 18px;
  }

  .terms-dialog__content {
    padding: 20px 20px;
  }

  .terms-section__title {
    font-size: 16px;
  }

  .terms-section__subtitle {
    font-size: 14px;
  }

  .terms-section__text {
    font-size: 13px;
  }

  .terms-dialog__footer {
    padding: 16px 20px;
  }

  .terms-dialog__button {
    padding: 10px 36px;
    font-size: 14px;
  }
}
</style>
