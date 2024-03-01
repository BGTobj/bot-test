const { Telegraf, Markup } = require('telegraf')
const { message } = require('telegraf/filters')
require('dotenv').config()
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const bot = new Telegraf('6546876939:AAHoYRs_HQMuIJgj1wuPp5fHaD-sQAjw1ww')
const creds = require('./credentials.json');
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ];
const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: SCOPES,
  });

const doc = new GoogleSpreadsheet(process.env.SPREADSHEETID, serviceAccountAuth);

const getInfo = async () => {
    await doc.loadInfo();
}

const mainMenu = Markup
    .keyboard([
      'Акции и спецпредложения', 
      'Адреса и график работы аптек', 
      'Мои аптеки',
      'Оставить отзыв',
      'Задать вопрос'
    ])
    .oneTime()
    .resize()

const backMainMenu = Markup.inlineKeyboard(
    [Markup.button.callback('В главное меню', 'mainMenu'),],
    )

bot.action('mainMenu', async ctx => {
    await ctx.reply(`Выберите, что Вас интересует`, mainMenu)
})
 // or use `doc.sheetsById[id]` or `doc.sheetsByTitle[title]`

bot.start(async (ctx) => {
    const userFirstName = ctx.message.chat.first_name;
    await ctx.reply(`Welcome, ${userFirstName}`, mainMenu)
});

const sendReview = async () => {
    const buttons = Markup.keyboard([
        'поблагодарить нас',
        'предложить идеи для улучшения',
        'отзыв о работе аптеки/сотрудника',
        'отзыв о наших товарах',
        'В главное меню'
    ])
    .oneTime()
    .resize()
    
    bot.hears('Оставить отзыв', async ctx => {
        await ctx.reply(`Выберите нужное`, buttons)
        console.log(buttons)
    })
   
    bot.hears('отзыв о работе аптеки/сотрудника', async (ctx) => {
            await ctx.reply(`Укажите адрес аптеки`);
    })

    bot.hears('Укажите адрес аптеки', async (ctx) => {

        await ctx.reply(`напишите, пожалуйста, ваш вопрос`);
    })

    bot.hears('поблагодарить нас', async (ctx) => {

        await ctx.reply(`напишите, пожалуйста, ваш вопрос`);
    })

    bot.hears('предложить идеи для улучшения', async (ctx) => {

        await ctx.reply(`напишите, пожалуйста, ваш вопрос`);
    })

    bot.hears('отзыв о наших товарах', async (ctx) => {

        await ctx.reply(`напишите, пожалуйста, ваш вопрос`);
    })
    

}

/* let transporter = nodemailer.createTransport({
    host: 'smtp.mail.ru',
    port: 587,
    secure: false,
    auth: {
      user: 'anton1ebedev222@mail.ru',
      pass: '%taTEatAYt14'
    }
  });


  async function main() {
    // send mail with defined transport object
    const info = await transporter.sendMail({
      from: '"Maddison Foo Koch 👻" <anton1ebedev222@mail.ru>', // sender address
      to: "bgtobj@gmail.com", // list of receivers
      subject: "Hello ✔", // Subject line
      text: "Hello world?", // plain text body
    });
  
    console.log("Message sent: %s", info.messageId);
    // Message sent: <d786aa62-4e0a-070a-47ed-0b0666549519@ethereal.email>
  }
  
  main().catch(console.error); */

sendReview();

bot.hears('Задать вопрос', async ctx => {
        await ctx.reply(`Для связи с оператором, вы будете перенаправлены в отдельный чат. Наши сотрудники помогут Вам и ответят на все вопросы\n Для продолжения нажмите ПЕРЕЙТИ`, 
            Markup.inlineKeyboard(
                [Markup.button.url('Перейти', 'https://t.me/bgtobj'),],
            )
        ) 
})

const cities = Markup
        .keyboard([
            'Владивосток', 
            'Хабаровск', 
            'Приморский Край',
            'Новосибирск',
            'Москва',
        ])
        .oneTime()
        .resize()
bot.hears('Адреса и график работы аптек', async ctx => {
    await ctx.reply(`Выберите населенный пункт`, cities, {parse_mode: 'HTML'});
  
})

bot.hears('Владивосток', async ctx => {
    let city = [];
    let idApt = [];
    let adress = [];
    let schedule = [];
    let urlYM = [];
    let aptekiKey = [];
    let apteki;
const msg = ctx.message.text;
    await getInfo();
    const aptekiSheet = doc.sheetsByIndex[0];
    const rows = await aptekiSheet.getRows();
    console.log(rows.length)
    for (i = 0; i < rows.length; i++) {
        city.push(rows[i].get('city'));
        idApt.push(rows[i].get('id_apt'));
        adress.push(rows[i].get('adress'));
        schedule.push(rows[i].get('schedule'));
        urlYM.push(rows[i].get('urlYM'));
        
         /* else if (msg === ) {
            await ctx.reply(`Адрес ${adress[i]}, расписание ${schedule[i]}, как проехать ${urlYM[i]}`);
        } */
        if (city[i] === msg) {
            apteki = Markup.inlineKeyboard(
                [Markup.button.callback(`Аптека № ${idApt[i]} на ${adress[i]}`, `${idApt[i]}`),],
            )
        
    }
    
        //aptekiKey.push(`Аптека № ${idApt[i]} на ${adress[i]}`);
        
    }
    await ctx.reply(`Выберите аптеку`, apteki, {parse_mode: 'HTML'});
        
})

/* bot.hears(`Аптека № ${idApt[i]} на ${adress[i]}`, async (ctx) => {
    await ctx.reply(`Адрес ${adress[i]}, расписание ${schedule[i]}, как проехать ${urlYM[i]}`);
}) */

bot.hears('Мои аптеки', async ctx => {
    await getInfo();
    const user = ctx.message.chat.username;
    const usersSheet = doc.sheetsByIndex[2];
    const rowsUser = await usersSheet.getRows();
    const aptekiSheet = doc.sheetsByIndex[0];
    const rows = await aptekiSheet.getRows();
    let idApt = [];
    let adress = [];
    let userName = [];
    let idAptUser = [];
    for (let j = 0; j < rows.length; j++) {
        idApt.push(rows[j].get('id_apt'));
        adress.push(rows[j].get('adress')); 
    }
    for (let k = 0; k < rowsUser.length; k++) {
        userName.push(rowsUser[k].get('username'));
        idAptUser.push(rowsUser[k].get('idApt'));
        if (userName == user) {
            return userName, idAptUser;
        }
    }
    let usersApteki;
    console.log(idAptUser)
    for (key in idAptUser) {
        if (idAptUser[key] === idApt[key] && userName[key] == user) {
        usersApteki = Markup.keyboard([
            `Аптека №${idApt} на ${adress}`
        ]).resize()
    }
    }
    
    await ctx.reply(`Выберите аптеку`, usersApteki)
    if (userName[key] !== user) {
        await ctx.reply(`Вы еще не добавили ни одну аптеку в избранное`);
    }
    
    //await usersSheet.addRow({ username: user, city: 'Москва', idApt: '8' });
})

//await ctx.reply(`Аптека № ${idApt} на ${adress}\n г. ${city}, ул. ${adress}\n режим работы ${schedule}\n ${urlYM}`, {parse_mode: 'HTML'})

bot.hears('Акции и спецпредложения', async ctx => {
    await ctx.reply(`Выберите населенный пункт`, cities, {parse_mode: 'HTML'});
})

bot.on(message('text'), async ctx => {
    let cityPromo = [];
    let namePromo = [];
    let datePromo = [];
    const msg = ctx.message.text;
    await getInfo();
    const promoSheet = doc.sheetsByIndex[1];
    const rowsPromo = await promoSheet.getRows();
    for (i = 0; i < rowsPromo.length; i++) {
        cityPromo.push(rowsPromo[i].get('city'));
        namePromo.push(rowsPromo[i].get('name'));
        datePromo.push(rowsPromo[i].get('date'));
        
         /* else if (msg === ) {
            await ctx.reply(`Адрес ${adress[i]}, расписание ${schedule[i]}, как проехать ${urlYM[i]}`);
        } */

    
        //aptekiKey.push(`Аптека № ${idApt[i]} на ${adress[i]}`);
        
    }
    for (const key in cityPromo) {
        if (cityPromo[key] === msg) {
            await ctx.reply(`${datePromo[key]} проходит акция ${namePromo[key]}, для уточнения подробностей акции переходите по <a href="https://monastirev.ru/promotions/">ссылке</a>`, {parse_mode: 'HTML', disable_web_page_preview: true});
        }/* else {
            await ctx.reply(`Сейчас нет действующих акций`);
        } */
    }
    
})

bot.launch()



