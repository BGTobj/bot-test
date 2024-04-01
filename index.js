import { Telegraf, Markup } from 'telegraf'
import { message } from 'telegraf/filters'
import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import bodyParser from 'body-parser'
import Mail from './mail.js'
const appMailer = express()
import { GoogleSpreadsheet } from'google-spreadsheet'
import { JWT } from 'google-auth-library'
const { BOT_TOKEN, CLIENT_EMAIL } = process.env
const { privateKey } = JSON.parse(process.env.PRIVATE_KEY)
const bot = new Telegraf(BOT_TOKEN)
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ];
const serviceAccountAuth = new JWT({
    email: CLIENT_EMAIL,
    key: privateKey,
    scopes: SCOPES,
  });

const doc = new GoogleSpreadsheet(process.env.SPREADSHEETID, serviceAccountAuth);
//получение данных из google-sheets
const getInfo = async () => {
    await doc.loadInfo();
    //const aptekiSheet = doc.sheetsByIndex[0];
    //const rows = await aptekiSheet.getRows();
}

let regionsKeyboard;
let citiesKeyboard;

const regionsTmp = [];
const citiesTmp = [];

let regions = [];
let cities = [];
//получение списка регионов и вывод клавиатуры для выбора региона
const getRegions = async () => {
    try {
        await getInfo();
    const aptekiSheet = doc.sheetsByIndex[0];
    const rows = await aptekiSheet.getRows();
    for (let row of rows) {
        regionsTmp.push(row.get('region'));  
    }
    regions = Array.from(new Set(regionsTmp));
    
    regionsKeyboard = Markup
    .keyboard([
        regions
    ]).oneTime().resize()
    }
    catch(e) {
        console.error(e)
    }
    
}
//главное меню
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

//вывод главного меню по нажатию кнопки "в главное меню
const backMainMenu = Markup.inlineKeyboard(
    [Markup.button.callback('В главное меню', 'mainMenu'),],
    )
bot.action('mainMenu', async ctx => {
    await ctx.reply(`Выберите, что Вас интересует`, mainMenu)
})
//команда запуска бота с приветствием и выбор пункта из главного меню
bot.start(async (ctx) => {
    const userFirstName = ctx.message.chat.first_name;
    await ctx.reply(`Welcome, ${userFirstName}`, mainMenu)
});
/*********** адреса и график работы аптек (не доделан вывод информации по выбранной аптеке согласно задаче, доделаю сам) *************/
const city = [];
let idApt = [];
let adress = [];
let res = [];
let i;

/* получение списка городов и вывод клавиатуры для выбора города */
const getCity = async () => {
    try {
        await getInfo();
    let key;
    const aptekiSheet = doc.sheetsByIndex[0];
    const rows = await aptekiSheet.getRows();
    bot.on(message('text'), async ctx => {
        const msg = ctx.message.text;
        for (key in regionsTmp) {
            city.push(rows[key].get('city'))
            if(regionsTmp[key] === msg) {
                citiesTmp.push(rows[key].get('city'));
            }
        }
        cities = Array.from(new Set(citiesTmp))
        citiesKeyboard = Markup
        .keyboard([
            cities
        ]).oneTime().resize()
        
        await ctx.reply(`Выберите город`, citiesKeyboard, {parse_mode: 'HTML'});
        regionsTmp.length = 0;
        citiesTmp.length = 0;
    })
    }
    catch(e) {
        console.error(e)
    }
   
}
/* получение списка аптек, согласно выбранного города и вывод клавиатуры для выбора аптеки */
const getDrugStore = async () => {
    try {
        bot.on(message('text'), async ctx => {
            await getInfo();
            const aptekiSheet = doc.sheetsByIndex[0];
            const rows = await aptekiSheet.getRows();
            const msg = ctx.message.text;
            for(i in city) {
                if (msg === city[i]) {
                    idApt.push(rows[i].get('id_apt'));
                    adress.push(rows[i].get('adress'));
                    res.push(`Аптека № ${idApt[i]} на ${adress[i]}`)
                }
            }
            console.log(res)
            let resKeyboard = Markup
            .keyboard([
                res
            ]).oneTime().resize()
            await ctx.reply(`Выберите аптеку`, resKeyboard, {parse_mode: 'HTML'})
        })
    }
    catch(e) {
        console.error(e)
    }
}
/*********** конец адреса и график работы аптек *************/

/**************** функция получения акций и предложений (работает правильно) ***********/
const promo = async () => {
    try {
        bot.on(message('text'), async ctx => {
            let regionPromo = [];
            let namePromo = [];
            let datePromo = [];
            const msg = ctx.message.text;
            await getInfo();
            const promoSheet = doc.sheetsByIndex[1];
            const rowsPromo = await promoSheet.getRows();
            let key;
            for (let row of rowsPromo) {
                namePromo.push(row.get('name'));
                datePromo.push(row.get('date'));
                regionPromo.push(row.get('region'));
            }
            for (key in regionPromo) {
                if(msg === regionPromo[key]) {
                    await ctx.reply(`${datePromo[key]} проходит акция ${namePromo[key]}, для уточнения подробностей акции переходите по <a href="https://monastirev.ru/promotions/">ссылке</a>`, {parse_mode: 'HTML', disable_web_page_preview: true});
                }
            }
        })
    }
    catch(e) {
        console.error(e)
    }
}
/**************** конец функции получения акций и предложений ***********/

/******************** функция получения списка аптек, если пользователь добавил какую-либо аптеку в избранное */
let usersApteki = [];
const myDrugStore = async () => {
    bot.on(message('text'), async ctx => {
        await getInfo();
        const msg = ctx.message.text;
        const user = ctx.message.chat.username;
        const usersSheet = doc.sheetsByIndex[2];
        const rowsUser = await usersSheet.getRows();
        let userName = [];
        let usersCity;
        let idAptUser;
        let i;
        const aptekiSheet = doc.sheetsByIndex[0];
        const rows = await aptekiSheet.getRows();
        let idApt;
        let adress;
        let city;
        let schedule;
        let urlYM;
        //получение списка пользователей из таблицы с пользователями
        for (let row of rowsUser) {
            userName.push(row.get('username'));
        }
        console.log(userName)
        
        //если пользователь найден в таблице - получение его id аптеки и города
        for (i in userName) {
            if(user === userName[i]) {
                idAptUser = rowsUser[i].get('idApt');
                usersCity = rowsUser[i].get('city');
            } else {
                return ctx.reply(`Вы еще не добавили ни одну аптеку в Избранное`)
            }
        }
        //получение адреса и id аптеки пользователя из таблицы с аптеками
        for (i = 0; i < rows.length; i++) {
            if ((rows[i].get('id_apt') === idAptUser) && (rows[i].get('city') === usersCity)) {
                idApt = rows[i].get('id_apt'); //id аптеки
                adress = rows[i].get('adress'); // адрес аптеки
                city = rows[i].get('city'); // город аптеки
                schedule = rows[i].get('schedule'); // расписание работы аптеки
                urlYM = rows[i].get('urlYM'); // ссылка на яндекс карты
            }
            
        }
        //название аптеки
        usersApteki.push(`Аптека №${idApt} на ${adress}`)
        //вывод информации об аптеке по клике на кнопку названия аптеки
        for (let apteka of usersApteki) {
            if (msg === apteka) {
                await ctx.reply(`Аптека № ${idApt} на ${adress} г. ${city}, ${adress}, режим работы ${schedule}, <a href="${urlYM}">как проехать</a>`, {parse_mode: 'HTML', disable_web_page_preview: true});
            }
        }
    })
}
/******************** конец функции получения списка аптек, если пользователь добавил какую-либо аптеку в избранное */

/* функция для кнопки задать вопрос (работает правильно) */
const sendQuestion = async () => {
    bot.hears('Задать вопрос', async ctx => {
        await ctx.reply(`Для связи с оператором, вы будете перенаправлены в отдельный чат. Наши сотрудники помогут Вам и ответят на все вопросы\n Для продолжения нажмите ПЕРЕЙТИ`, 
            Markup.inlineKeyboard(
                [Markup.button.url('Перейти', 'https://t.me/bgtobj'),],
            )
        )
    })
        
}

// функция для кнопки оставить отзыв (не доделано до конца по задаче)
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
    bot.hears('В главное меню', async ctx => {
        ctx.reply(`Выберите, что Вас интересует`, mainMenu)
    })
    bot.hears('Оставить отзыв', async ctx => {
        await ctx.reply(`Выберите нужное`, buttons)
        let msg = ctx.message.text;
        await ctx.reply(`напишите, пожалуйста, ваш вопрос`);
        bot.on(message('text'), async ctx => {
            
            await ctx.reply(`Если хотите получить ответ, введите пожалуйста, адрес электронной почты или телефон`, Markup.inlineKeyboard([
                Markup.button.callback('Пропустить', 'Check')]));
        })
    })
   
    bot.hears('отзыв о работе аптеки/сотрудника', async (ctx) => {
            await ctx.reply(`Укажите адрес аптеки`);
    })
    bot.hears('Укажите адрес аптеки', async (ctx) => {
        

        
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
//функция обработки кнопок из главного меню
const app = async () => {
    bot.hears("Адреса и график работы аптек", async ctx => {
        await getRegions();
        await ctx.reply(`Выберите населенный пункт`, regionsKeyboard, {parse_mode: 'HTML'});
        try {
            await getCity();
            await getDrugStore()
        }
        catch(e) {
            console.error(e)
        }
    })

    bot.hears("Акции и спецпредложения", async ctx => { 
        await getRegions();
        await ctx.reply(`Выберите населенный пункт`, regionsKeyboard, {parse_mode: 'HTML'});
        try {
            await promo() 
        }
        catch(e) {
            console.error(e)
        }       
    })
    bot.hears('Мои аптеки', async ctx => {
        await myDrugStore();
        await ctx.reply(`Ваши аптеки`, usersApteki, {parse_mode: 'HTML'})
    })
    await sendQuestion()
    await sendReview()
    
}

await app();

bot.launch()

