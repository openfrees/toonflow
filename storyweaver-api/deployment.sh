echo '丢弃本地修改'
git reset --hard

echo '拉取远程代码'
git pull origin main

if [ "$1" == 'new' ]
then
    echo '重新安装依赖'
    npm install
fi

echo '重启服务'
npm run stop
npm run start
