/* qrcode 类型声明 */
declare module 'qrcode' {
    interface QRCodeOptions {
        width?: number
        margin?: number
        color?: {
            dark?: string
            light?: string
        }
    }
    function toDataURL(text: string, options?: QRCodeOptions): Promise<string>
    export { toDataURL }
    export default { toDataURL }
}
