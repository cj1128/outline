const qiniu = require('qiniu');

const putPolicy = new qiniu.rs.PutPolicy({
  scope: process.env.QINIU_BUCKET,
  expires: 10 * 365 * 24 * 3600, // 10 years, in seconds
})

const mac = new qiniu.auth.digest.Mac(process.env.QINIU_ACCESS_KEY, process.env.QINIU_SECRET_KEY)
const uploadToken = putPolicy.uploadToken(mac)

const config = new qiniu.conf.Config()
config.zone = qiniu.zone.Zone_z0 // 华东

const formUploader = new qiniu.form_up.FormUploader(config)

// reject: error
// resolve: null
const uploadFile = (name, buffer) => new Promise((resolve, reject) => {
  const putExtra = new qiniu.form_up.PutExtra()

  formUploader.put(
    uploadToken,
    'doc/' + name,
    buffer,
    putExtra,
    (respErr, respBody, respInfo) => {
      if(respErr) {
        reject(respErr)
        return
      }

      if(respInfo.status !== 200) {
        reject(new Error(`qiniu upload error: ${ respBody.error }`))
        return
      }

      resolve(process.env.QINIU_DOMAIN + '/' + respBody.key)
    },
  )
})



module.exports = {
  uploadFile,
}
