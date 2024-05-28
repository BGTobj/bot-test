import { Markup, Scenes } from "telegraf";
import { message } from 'telegraf/filters'
import express from 'express'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
dotenv.config()
import { GoogleSpreadsheet } from'google-spreadsheet'
import { JWT } from 'google-auth-library'
import sqlite3  from 'sqlite3'
sqlite3.verbose();
import Mail from './mail.js'
const { SPREADSHEETID_PROD, CLIENT_EMAIL, EMAIL_HOST_USER, GROUP_URL } = process.env
const { privateKey } = JSON.parse(process.env.PRIVATE_KEY)
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ];
const serviceAccountAuth = new JWT({
    email: CLIENT_EMAIL,
    key: privateKey,
    scopes: SCOPES,
  });

const doc = new GoogleSpreadsheet(SPREADSHEETID_PROD, serviceAccountAuth);

const appMailer = express()
appMailer.use(bodyParser.json())

const db = new sqlite3.Database('bot.db');
let sql;
let userId;
let userCity;
let userDrugStoreId;
let userDrugStoreAdress;
const mainMenu = Markup
    .keyboard([
        ['📢 Акции и спецпредложения', 
        '📍 Адреса и время работы'],
        ['⭐️ Мои аптеки', 
        '📝 Оставить отзыв'],
        ['❓ Задать вопрос',
        '⚠️ Важные сообщения'],
        ['💚 Наш канал']
    ])
    .oneTime()
    .resize()

const deleteFavoriteKeyboard = Markup.inlineKeyboard(
    [[Markup.button.callback('Удалить из избранного', 'deleteFavorite')],
    [Markup.button.callback('🏠 В главное меню', 'mainMenu')]],).oneTime().resize()

const insertFavoriteKeyboard = Markup.inlineKeyboard(
    [[Markup.button.callback('⭐️ Добавить в избранное', 'insertFavorite')],
    [Markup.button.callback('🏠 В главное меню', 'mainMenu')]],).oneTime().resize()

const fullRegions = [];
let regions = [];
let regionsRes = [];
let cities = [];
let idApt = [];
let adress = [];
let schedule = [];
let urlYm = [];
let importantMsg = [];
let arCity = [];
let arCityRes = []
let arDrugStore = [];
let regionPromo = [];
let namePromo = [];
let datePromo = [];
let idAptPromo = [];
let adressPromo = [];
let urlPromo = [];
let nameImportant = [];
let dateImportant = [];
let regionImportant = [];
let cityImportant = [];
let idAptImportant = [];
let adressImportant = [];
let promoKeyboardRes = []
let promoKeyboard = [`Акции в аптеке`, `Акции в регионе`, '↩️ Назад']
while(promoKeyboard.length) promoKeyboardRes.push(promoKeyboard.splice(0,2));
let importantMsgKeyboardRes = [];
let importantMsgKeyboard = [`Сообщения по городу`, `Сообщения по аптекам`, '↩️ Назад']
while(importantMsgKeyboard.length) importantMsgKeyboardRes.push(importantMsgKeyboard.splice(0,2));
//получение данных из google-sheets
const getInfo = async () => {
    await doc.loadInfo()
    const aptekiSheet = doc.sheetsByIndex[0];
    const rows = await aptekiSheet.getRows();
    const promoSheet = doc.sheetsByIndex[1];
    const rowsPromo = await promoSheet.getRows();
    const importantSheet = doc.sheetsByIndex[2];
    const rowsImportant = await importantSheet.getRows();
    for (let rowImp of rowsImportant) {
        nameImportant.push(rowImp.get('name'));
        dateImportant.push(rowImp.get('date'));
        regionImportant.push(rowImp.get('region'));
        cityImportant.push(rowImp.get('city'));
        idAptImportant.push(rowImp.get('id_apt'));
        adressImportant.push(rowImp.get('adress'));
    }
    for (let row of rowsPromo) {
        namePromo.push(row.get('name'));
        datePromo.push(row.get('date'));
        regionPromo.push(row.get('region'));
        idAptPromo.push(row.get('id_apt_promo'));
        adressPromo.push(row.get('adress_apt_promo'));
        urlPromo.push(row.get('url_promo'));
    }
    for (let key in rows) {
        fullRegions.push(rows[key].get('region'));
        cities.push(rows[key].get('city'))
        idApt.push(rows[key].get('id_apt'));
        adress.push(rows[key].get('adress'));
        schedule.push(rows[key].get('schedule'));
        urlYm.push(rows[key].get('urlYM'));
        importantMsg.push(rows[key].get('important'));
    }
    
    regions = Array.from(new Set(fullRegions));
    while(regions.length) regionsRes.push(regions.splice(0,2));
}
getInfo();
let tmpRegion;
const buttons = ['Поблагодарить нас', 'Предложить идеи для улучшения', 'Отзыв о работе аптеки/сотрудника', 'Отзыв о наших товарах', '🏠 В главное меню'];
let userMessage = ''
let userEmail = 'Не указал'
let adressDrugStore = 'Не указал'
const backMainMenu = Markup.inlineKeyboard(
    [[Markup.button.callback('↩️ Назад', 'back'),],
    [Markup.button.callback('🏠 В главное меню', 'mainMenu'),],
    ])
// Handler factories
const { enter, leave } = Scenes.Stage;

class SceneGenerator {
    //Начало сцены "Акции и спецпредложения" с выбором акций в регионе или конкретной аптеке
    startPromoScene() {
        const startPromo = new Scenes.BaseScene("startPromo");
        startPromo.enter((ctx) => {
            ctx.reply(`Выберите, что вас интересует`, Markup.keyboard(promoKeyboardRes).oneTime().resize())
        })
        
        startPromo.on(message('text'), ctx => {
            const msg = ctx.message.text;
            if (msg === '/start' || msg === '↩️ Назад') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            if (msg === `Акции в регионе`) {
                ctx.scene.leave()
                ctx.scene.enter('promo')
            }
            if (msg === `Акции в аптеке`) {
                ctx.scene.leave()
                ctx.scene.enter('getPromoCity')
            }
        })
        return startPromo;
    }

    //получение списка городов из выбранного региона для акций
    getPromoCityScene() {
        const getPromoCity = new Scenes.BaseScene("getPromoCity");
        getPromoCity.enter( (ctx) => {
            ctx.reply(`Выберите населенный пункт`, Markup.keyboard(regionsRes).oneTime().resize(), {parse_mode: 'HTML'})
            ctx.reply(`Вернуться назад или в главное меню`, backMainMenu)
            arCityRes.length = 0;
        });
        getPromoCity.action('mainMenu', ctx => {
            ctx.scene.leave()
            ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getPromoCity.action('back', ctx => {
            ctx.scene.leave()
            ctx.scene.enter('startPromo')
        })
        getPromoCity.on(message('text'), async ctx => {
            
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            for (let i in fullRegions) {
                if (msg === fullRegions[i]) {
                    arCity.push(cities[i]);
                    tmpRegion = msg;
                }
            }
            
            arCity = Array.from(new Set(arCity))
            while(arCity.length) arCityRes.push(arCity.splice(0,2));
            if (arCityRes.length > 0) {
                ctx.scene.leave()
                ctx.scene.enter('getListPromoDrugStore')
            } else {
                ctx.scene.leave()
            }
        })
        getPromoCity.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return getPromoCity;
    }

    //получение списка аптек из выбранного города для акций
    getListPromoDrugStoreScene() {
        const getListPromoDrugStore = new Scenes.BaseScene("getListPromoDrugStore");
        getListPromoDrugStore.enter( (ctx) => {
            ctx.reply(`Выберите город`, Markup.keyboard(arCityRes).oneTime().resize(), {parse_mode: 'HTML'}) 
            ctx.reply(`Вернуться назад или в главное меню`, backMainMenu)
        });
        getListPromoDrugStore.action('mainMenu', ctx => {
            arCityRes.length = 0;
            ctx.scene.leave()
            ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getListPromoDrugStore.action('back', ctx => {
            ctx.scene.leave()
            ctx.scene.enter('getPromoCity')
        })
        getListPromoDrugStore.on(message('text'), async ctx  => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            for (let i in fullRegions) {
                if (msg === cities[i]) {
                    arDrugStore.push(`Аптека №${idApt[i]} на ${adress[i]}`);
                }
            }
            arCity.length = 0;
            //arCityRes.length = 0;
            if (arDrugStore.length > 0) {
                ctx.scene.leave()
                ctx.scene.enter('getPromoDrugStore')
            } else {
                ctx.scene.leave()
            }
        })
        getListPromoDrugStore.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return getListPromoDrugStore;
    }

    //получение акций по выбранной аптеке
    getPromoDrugStoreScene() {
        const getPromoDrugStore = new Scenes.BaseScene("getPromoDrugStore");
        getPromoDrugStore.enter( (ctx) => {
            ctx.reply(`Выберите аптеку`, Markup.keyboard(arDrugStore).oneTime().resize(), {parse_mode: 'HTML'})
            ctx.reply(`Вернуться назад или в главное меню`, backMainMenu)
        });
        getPromoDrugStore.action('mainMenu', async ctx => {
            arDrugStore.length = 0;
            ctx.scene.leave()
            await ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getPromoDrugStore.action('back', ctx => {
            arDrugStore.length = 0;
            ctx.scene.leave()
            ctx.scene.enter('getListPromoDrugStore')
        })
        getPromoDrugStore.on(message('text'), async ctx  => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            
            let arResPromo = [];
            let arResPromoRegion = [];
            for (let i in idAptPromo) {
                if (msg === `Аптека №${idAptPromo[i]} на ${adressPromo[i]}`) {
                    arResPromo.push(`В аптеке № ${idAptPromo[i]} по адресу ${adressPromo[i]} ${datePromo[i]} проходит акция "${namePromo[i]}", для уточнения подробностей акции переходите по <a href="${urlPromo[i]}">ссылке</a>\n`)
                } else if (tmpRegion === regionPromo[i]){
                    arResPromoRegion.push(`${datePromo[i]} проходит акция "${namePromo[i]}", для уточнения подробностей акции переходите по <a href="${urlPromo[i]}">ссылке</a>\n`)
                    continue
                }
                
            }
            arDrugStore.length = 0;
            if (arResPromo.length > 0) {
                ctx.reply(arResPromo.join(''), {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: backMainMenu.reply_markup});
            } else {
                ctx.reply(`В выбранной аптеке сейчас нет активных акций 😔. Акции в регионе ${tmpRegion} 👇`)
                ctx.reply(arResPromoRegion.join(''), {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: backMainMenu.reply_markup});
            }
        })
        getPromoDrugStore.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return getPromoDrugStore;
    }

    //получение всех проходящих акций из выбранного региона
    getPromoScene() {
        const promo = new Scenes.BaseScene("promo");
        promo.enter( (ctx) => {
            ctx.reply(`Выберите населенный пункт`, Markup.keyboard(regionsRes).oneTime().resize(), {parse_mode: 'HTML'})
            ctx.reply(`Вернуться назад или в главное меню`, backMainMenu)
        });
        promo.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        promo.action('back', async ctx => {
            ctx.scene.leave()
            await ctx.scene.enter('startPromo')
        })
        promo.on(message('text'), async ctx => {
            const msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            let arResPromo = []
            for (let key in regionPromo) {
                if(msg === regionPromo[key]) {
                    arResPromo.push(`${datePromo[key]} проходит акция "${namePromo[key]}", для уточнения подробностей акции переходите по <a href="${urlPromo[key]}">ссылке</a>\n`)
                } else {
                    continue
                }
            }
            if (arResPromo.length > 0) {
                await ctx.reply(arResPromo.join(''), {parse_mode: 'HTML', disable_web_page_preview: true,  reply_markup: backMainMenu.reply_markup});
            } else {
                ctx.reply(`В выбранном регионе сейчас нет активных акций 😔`, backMainMenu)
            }
        });
        promo.on("message", (ctx) => {
            ctx.reply("Вы не выбрали населенный пункт");
            ctx.scene.reenter()
        });
        
        return promo;
    }

    //сцена обработки кнопки Задать вопрос и переход в чат для связи с оператором
    sendQuestionScene() {
        const sendQuestion = new Scenes.BaseScene("sendQuestion");
        sendQuestion.enter( (ctx) => {
            ctx.reply(`Для связи с оператором, вы будете перенаправлены в отдельный чат. Наши сотрудники помогут Вам и ответят на все вопросы\nДля продолжения нажмите <b>Перейти</b> 👇`, 
                    {parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard(
                    [[Markup.button.url('⚠️ Перейти', GROUP_URL)],
                    [Markup.button.callback('🏠 В главное меню', 'mainMenu')],], 
                ).reply_markup}
            )
            ctx.scene.leave()
        })
        sendQuestion.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        sendQuestion.on("message", (ctx) => {
            ctx.reply("Ошибка");
            ctx.scene.leave()
        })
        return sendQuestion;    
    }

    //Сцена "Адреса и график работы аптек", выбор региона и получение списка городов
    getCityScene() {
        const getCity = new Scenes.BaseScene("getCity");
        getCity.enter( (ctx) => {
            ctx.reply(`Выберите населенный пункт`, Markup.keyboard(regionsRes).oneTime().resize(), {parse_mode: 'HTML'})
            ctx.reply(`Вернуться в главное меню`, Markup.inlineKeyboard([Markup.button.callback('🏠 В главное меню', 'mainMenu'),]))
            arCityRes.length = 0;
        })
        getCity.action('mainMenu', ctx => {
            ctx.scene.leave();
            ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getCity.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            for (let i in fullRegions) {
                if (msg === fullRegions[i]) {
                    arCity.push(cities[i]);
                }
            }
            arCity = Array.from(new Set(arCity))
            while(arCity.length) arCityRes.push(arCity.splice(0,2));
            if (arCityRes.length > 0) {
                ctx.scene.leave()
                ctx.scene.enter('getListDrugStore')
            } else {
                ctx.scene.leave()
            }
            
        })
        getCity.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return getCity;
    }

    //Сцена "Адреса и график работы аптек", выбор города и получение списка аптек из города
    getListDrugStoreScene() {
        const getListDrugStore = new Scenes.BaseScene("getListDrugStore");
        getListDrugStore.enter( (ctx) => {
            ctx.reply(`Выберите город`, Markup.keyboard(arCityRes).oneTime().resize(), {parse_mode: 'HTML'})
            ctx.reply(`Вернуться назад или в главное меню`, backMainMenu)
        })
        getListDrugStore.action('mainMenu', ctx => {
            arCityRes.length = 0;
            ctx.scene.leave()
            ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getListDrugStore.action('back', ctx => {
            ctx.scene.leave()
            ctx.scene.enter('getCity')
        })
        getListDrugStore.on(message('text'), async ctx  => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            for (let i in fullRegions) {
                if (msg === cities[i]) {
                    arDrugStore.push(`Аптека №${idApt[i]} на ${adress[i]}`);
                    userCity = msg
                }
            }
            arCity.length = 0;
            //arCityRes.length = 0;
            if (arDrugStore.length > 0) {
                ctx.scene.leave()
                ctx.scene.enter('getDrugStore')
            } else {
                ctx.scene.leave()
            }
        })
        getListDrugStore.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return getListDrugStore;
    }

    //Сцена "Адреса и график работы аптек", выбор аптеки и получение сообщения с информацией об аптеке
    getDrugStoreScene() {
        const getDrugStore = new Scenes.BaseScene("getDrugStore");
        getDrugStore.enter( (ctx) => {
            ctx.reply(`Выберите аптеку`, Markup.keyboard(arDrugStore).oneTime().resize(), {parse_mode: 'HTML'})
            ctx.reply(`Вернуться назад или в главное меню`, backMainMenu)
        })
        getDrugStore.action('mainMenu', async ctx => {
            arDrugStore.length = 0;
            ctx.scene.leave()
            await ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getDrugStore.action('back', ctx => {
            arDrugStore.length = 0;
            ctx.scene.leave()
            ctx.scene.enter('getListDrugStore')
        })
        getDrugStore.on(message('text'), async ctx  => {
            userId = ctx.message.from.id;
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            for (let i in fullRegions) {
                if (msg === `Аптека №${idApt[i]} на ${adress[i]}`) {
                    userDrugStoreId = idApt[i];
                    userDrugStoreAdress = adress[i];
                    db.serialize(() => {
                        db.get(`SELECT id_apt, user_id FROM usersDrugstores WHERE id_apt = ? AND user_id = ?`, [userDrugStoreId, userId], (err, row) => {
                            if (err) {
                                return console.error(err.message)
                            }
                            ctx.reply(`Аптека № ${idApt[i]}, г. ${cities[i]}, ${adress[i]}, режим работы ${schedule[i]}, <a href="${urlYm[i]}">как проехать</a>`, {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: row ? deleteFavoriteKeyboard.reply_markup : insertFavoriteKeyboard.reply_markup});
                        });
                    })
                }
            }
            arDrugStore.length = 0;
        })
        getDrugStore.action('insertFavorite', (ctx) => {
            ctx.scene.leave()
            ctx.scene.enter('insertFavoriteDrugstore')
        })
        getDrugStore.action('deleteFavorite', (ctx) => {
            ctx.scene.leave()
            ctx.scene.enter('deleteFavoriteDrugstore');
        })
        getDrugStore.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getDrugStore.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return getDrugStore;
    }

    //Сцена "Адреса и график работы аптек", сцена обработка кнопки "Добавить в избранное"
    insertFavoriteDrugstoreScene() {
        const insertFavoriteDrugstore = new Scenes.BaseScene("insertFavoriteDrugstore");
        insertFavoriteDrugstore.enter(async ctx => {
            let userFavoriteDrugstoreData = [];
            userFavoriteDrugstoreData.push(userDrugStoreId, userCity, userDrugStoreAdress, userId)
            db.serialize(() => {
                sql = `INSERT INTO usersDrugstores(id_apt, cityOfDrugstore, adress, user_id) VALUES (?,?,?,?)`;
                db.run(sql, userFavoriteDrugstoreData, (e) => {
                    if(e) {
                        return console.error(e.message)
                    }
                    ctx.reply(`Аптека добавлена в избранное`)
                });
            })
            await ctx.reply(`Если у вас остались вопросы, то можете ознакомиться с полной информацией по ассортименту в МП (ссылка), на сайте (ссылка) или задать вопрос оператору (ссылка)`, {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: backMainMenu.reply_markup})
            ctx.scene.leave()
        })       
        return insertFavoriteDrugstore;
    }

    //Сцена "Мои аптеки", сцена обработка кнопки "Удалить из избранного"
    deleteFavoriteDrugstoreScene() {
        const deleteFavoriteDrugstore = new Scenes.BaseScene("deleteFavoriteDrugstore");
        deleteFavoriteDrugstore.enter(async (ctx) => {
            db.serialize(() => {
                db.get(`SELECT id_apt, user_id FROM usersDrugstores WHERE id_apt = ? AND user_id = ?`, [userDrugStoreId, userId], (err, row) => {
                    if (err) {
                        return console.error(err.message)
                    }
                    if (row) {
                        sql = `DELETE FROM usersDrugstores WHERE id_apt = ? AND user_id = ?`;
                        db.run(sql, [userDrugStoreId, userId], (e) => {
                            if(e) {
                                return console.error(e.message)
                            }
                            ctx.scene.leave()
                        });
                        ctx.reply(`Аптека удалена из избранного`)
                    } else {
                        ctx.reply(`Этой аптеки нет в избранном`);
                        ctx.scene.leave()
                    }
                });  
            })
            await ctx.reply(`Если у вас остались вопросы, то можете ознакомиться с полной информацией по ассортименту в МП (ссылка), на сайте (ссылка) или задать вопрос оператору (ссылка)`, {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: backMainMenu.reply_markup})
            ctx.scene.leave()
        })
        return deleteFavoriteDrugstore;
    }

    //Сцена "Мои аптеки"
    myDrugStoresScene() {
        const myDrugStores = new Scenes.BaseScene("myDrugStores");
        myDrugStores.enter( (ctx) => {
            userId = ctx.message.from.id;
            let arUsersDrugstore = [];
            db.serialize(() => {
                sql = `SELECT id_apt, user_id, adress FROM usersDrugstores ORDER BY id_apt`
                db.all(sql, (err, rows) => {
                    if (err) {
                        return console.error(err.message)
                    }
                    rows.forEach((row) => {
                        if (row.user_id === userId) {
                            arUsersDrugstore.push(`Аптека №${row.id_apt} на ${row.adress}`)
                        }
                    });
                    if(arUsersDrugstore.length > 0) {
                        ctx.reply(`Ваши аптеки`, Markup.keyboard(arUsersDrugstore).oneTime().resize())
                        ctx.scene.enter('getDrugStore')
                    } else {
                        return ctx.reply(`У вас пока нет аптек в избранном 🙂`, Markup.inlineKeyboard([Markup.button.callback('🏠 В главное меню', 'mainMenu')]))
                    }
                  }); 
            })
            ctx.scene.leave()
        })
        myDrugStores.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return myDrugStores;
    }

    //Сцена "Оставить отзыв"
    sendReviewScene() {
        const sendReview = new Scenes.BaseScene("sendReview");
        sendReview.enter((ctx) => {
            ctx.reply(`👇 Выберите категорию`, Markup.keyboard(buttons).oneTime().resize(), {parse_mode: 'HTML'})
        })
        sendReview.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg === "Отзыв о работе аптеки/сотрудника") {
                ctx.scene.leave()
                ctx.scene.enter('getReviewMessageMan')
            } else if (msg === "🏠 В главное меню" || msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            } else {
                for (let i in buttons) {
                    if (msg === buttons[i-1]) {
                        ctx.scene.leave()
                        ctx.scene.enter('getReviewMessage')
                    }
                }
            }  
        })
        sendReview.on(message, async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Ошибка`, backMainMenu)
        })
        return sendReview;
    }

    //Сцена "Оставить отзыв", отзыв о работе аптеки/сотрудника (указать адрес аптеки)
    getReviewMessageManScene() {
        const getReviewMessageMan = new Scenes.BaseScene("getReviewMessageMan");
        getReviewMessageMan.enter((ctx) => {
            ctx.reply(`✏️ Укажите, пожалуйста, адрес аптеки в формате "улица дом"`, backMainMenu)
        })
        getReviewMessageMan.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            adressDrugStore = msg
            ctx.scene.leave()
            ctx.scene.enter('getReviewMessage')
        })
        getReviewMessageMan.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getReviewMessageMan.action('back', async ctx => {
            ctx.scene.leave()
            ctx.scene.enter('sendReview')
        })
        getReviewMessageMan.on(message, async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Ошибка`, backMainMenu)
        })
        return getReviewMessageMan;
    }

    //Сцена "Оставить отзыв", получение отзыва от пользователя
    getReviewMessageScene() {
        const getReviewMessage = new Scenes.BaseScene("getReviewMessage");
        getReviewMessage.enter((ctx) => {
            ctx.reply(`✏️ Напишите, пожалуйста, ваш отзыв или предложите идею для улучшения`, backMainMenu)
        })
        getReviewMessage.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg.length === 0) {
                ctx.scene.reenter()
            } else if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            } else {
                userMessage = msg;
                ctx.reply(`✏️ Укажите, пожалуйста, адрес вашей электронной почты, телефон если желаете получить ответ`, Markup.inlineKeyboard(
                    [Markup.button.callback('Пропустить', 'Check'),]))
                ctx.scene.leave()
                ctx.scene.enter('getUserEmail')
            }
        })
        getReviewMessage.action('back', async ctx => {
            ctx.scene.leave()
            ctx.scene.enter('sendReview')
        })
        getReviewMessage.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getReviewMessage.on(message, async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Ошибка`, backMainMenu)
        })
        return getReviewMessage;
    }

    //Сцена "Оставить отзыв", получение email или номера телефона от пользователя (можно не указывать)
    getUserEmailScene() {
        const getUserEmail = new Scenes.BaseScene("getUserEmail");
        getUserEmail.action('Check', (ctx) => {
            ctx.reply(`👇 Нажмите кнопку "отправить", чтобы отправить сообщение нам на почту`, Markup.inlineKeyboard(
                [Markup.button.callback('Отправить', 'Send'),],
                ))
                ctx.scene.leave()
                ctx.scene.enter('postReview')
            })
        getUserEmail.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            } else {
                userEmail = msg;
            ctx.reply(`👇 Нажмите кнопку "отправить", чтобы отправить сообщение нам на почту`, Markup.inlineKeyboard(
                [Markup.button.callback('Отправить', 'Send'),],))
            ctx.scene.leave()
            ctx.scene.enter('postReview')
            }
        })
        getUserEmail.on(message, async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Ошибка`, backMainMenu)
        })
        return getUserEmail;
    }

    //Сцена "Оставить отзыв", отправка сообщения от пользователя на почту компании
    postReviewScene() {
        const postReview = new Scenes.BaseScene("postReview");
        postReview.action('Send', async (ctx) => {
            const data = `Адрес аптеки: ${adressDrugStore}\nПочта пользователя: ${userEmail}\nСообщение: ${userMessage}`
            Mail.send(EMAIL_HOST_USER, data)
            ctx.reply(`Ваш вопрос передан в отдел контроля качества. Мы отвечаем в течение 2-х дней, но постараемся сделать это быстрее. Не забудьте проверить вашу почту и папку спам. Спасибо, что помогаете нам развиваться!`, Markup.inlineKeyboard([Markup.button.callback('🏠 В главное меню', 'mainMenu')]))
            ctx.scene.leave()
        })
        postReview.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        return postReview;
    }

    //Начало сцены "Важные сообщения" с выбором собщений по городу или конкретной аптеке

    startImportantMsgScene() {
        const startImportantMsg = new Scenes.BaseScene("startImportantMsg");
        startImportantMsg.enter((ctx) => {
            ctx.reply(`Выберите, что вас интересует`, Markup.keyboard(importantMsgKeyboardRes).oneTime().resize())
        })

        startImportantMsg.on(message('text'), ctx => {
            const msg = ctx.message.text;
            if (msg === '/start' || msg === '↩️ Назад') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            if (msg === `Сообщения по городу`) {
                ctx.scene.leave()
                ctx.scene.enter('importantMessageCity')
            }
            if (msg === `Сообщения по аптекам`) {
                ctx.scene.leave()
                ctx.scene.enter('getListCityImpotrantMsg')
            }
        })
        return startImportantMsg;
    }

    //Сцена "Важные сообщения", получение списка городов по выбранному региону
    importantMessageCityScene() {
        const importantMessageCity = new Scenes.BaseScene("importantMessageCity");
        importantMessageCity.enter((ctx) => {
            ctx.reply(`Выберите населенный пункт`, Markup.keyboard(regionsRes).oneTime().resize(), {parse_mode: 'HTML'})
            ctx.reply(`Вернуться назад или в главное меню`, backMainMenu)
            arCityRes.length = 0;
        })
        importantMessageCity.action('mainMenu', ctx => {
            ctx.scene.leave()
            ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        importantMessageCity.action('back', ctx => {
            ctx.scene.leave()
            ctx.scene.enter('startImportantMsg')
        })
        importantMessageCity.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            for (let i in fullRegions) {
                if (msg === fullRegions[i]) {
                    arCity.push(cities[i]);
                }
            }
            arCity = Array.from(new Set(arCity))
            while(arCity.length) arCityRes.push(arCity.splice(0,2));
            if (arCityRes.length > 0) {
                ctx.scene.leave()
                ctx.scene.enter('getImportantMessage')
            } else {
                ctx.scene.leave()
            }
            
        })
        importantMessageCity.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return importantMessageCity;
    }

    //Сцена "Важные сообщения", получение важных сообщений по выбранному городу
    getImportantMessageScene() {
        const getImportantMessage = new Scenes.BaseScene("getImportantMessage");
        getImportantMessage.enter( (ctx) => {
            ctx.reply(`Выберите город`, Markup.keyboard(arCityRes).oneTime().resize(), {parse_mode: 'HTML'})
            ctx.reply(`Вернуться назад или в главное меню`, backMainMenu)
        })
        getImportantMessage.action('mainMenu', ctx => {
            arCityRes.length = 0;
            ctx.scene.leave()
            ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getImportantMessage.action('back', ctx => {
            ctx.scene.leave()
            ctx.scene.enter('importantMessageCity')
        })
        getImportantMessage.on(message('text'), async ctx  => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            let arResImportant = [];
            for (let key in cityImportant) {
                if (msg === cityImportant[key]) {
                    arResImportant.push(`Важное сообщение по городу ${cityImportant[key]} : <b>${nameImportant[key]}</b>\n`)
                    
                } else {
                    continue
                }
            }
            if (arResImportant.length > 0) {
                await ctx.reply(arResImportant.join(''), {parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard([Markup.button.callback('🏠 В главное меню', 'mainMenu')]).reply_markup});
            } else {
                ctx.reply(`В выбранном городе сейчас нет важных сообщений 😔`, Markup.inlineKeyboard([Markup.button.callback('🏠 В главное меню', 'mainMenu')]))
            }
            arCity.length = 0;
            ctx.scene.leave()
        })
        
        getImportantMessage.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return getImportantMessage;
    }

    //получение списка городов из выбранного региона с важными сообщениями
    getListCityImpotrantMsgScene () {
        const getListCityImpotrantMsg = new Scenes.BaseScene("getListCityImpotrantMsg");
        getListCityImpotrantMsg.enter( (ctx) => {
            ctx.reply(`Выберите населенный пункт`, Markup.keyboard(regionsRes).oneTime().resize(), {parse_mode: 'HTML'})
            ctx.reply(`Вернуться назад или в главное меню`, backMainMenu)
            arCityRes.length = 0;
        });
        getListCityImpotrantMsg.action('mainMenu', ctx => {
            ctx.scene.leave()
            ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getListCityImpotrantMsg.action('back', ctx => {
            ctx.scene.leave()
            ctx.scene.enter('startImportantMsg')
        })
        getListCityImpotrantMsg.on(message('text'), async ctx => {
            
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            for (let i in fullRegions) {
                if (msg === fullRegions[i]) {
                    arCity.push(cities[i]);
                }
            }
            
            arCity = Array.from(new Set(arCity))
            while(arCity.length) arCityRes.push(arCity.splice(0,2));
            if (arCityRes.length > 0) {
                ctx.scene.leave()
                ctx.scene.enter('getListImportantMsgDrugStore')
            } else {
                ctx.scene.leave()
            }
        })
        getListCityImpotrantMsg.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return getListCityImpotrantMsg;
    }

    //получение списка аптек из выбранного города с важными сообщениями
    getListImportantMsgDrugStoreScene() {
        const getListImportantMsgDrugStore = new Scenes.BaseScene("getListImportantMsgDrugStore");
        getListImportantMsgDrugStore.enter( (ctx) => {
            ctx.reply(`Выберите город`, Markup.keyboard(arCityRes).oneTime().resize(), {parse_mode: 'HTML'}) 
            ctx.reply(`Вернуться назад или в главное меню`, backMainMenu)
        });
        getListImportantMsgDrugStore.action('mainMenu', ctx => {
            arCityRes.length = 0;
            ctx.scene.leave()
            ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getListImportantMsgDrugStore.action('back', ctx => {
            ctx.scene.leave()
            ctx.scene.enter('getListCityImpotrantMsg')
        })
        getListImportantMsgDrugStore.on(message('text'), async ctx  => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            for (let i in fullRegions) {
                if (msg === cities[i]) {
                    arDrugStore.push(`Аптека №${idApt[i]} на ${adress[i]}`);
                }
            }
            arCity.length = 0;
            //arCityRes.length = 0;
            if (arDrugStore.length > 0) {
                ctx.scene.leave()
                ctx.scene.enter('getImportantMsgDrugStore')
            } else {
                ctx.scene.leave()
            }
        })
        getListImportantMsgDrugStore.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return getListImportantMsgDrugStore;
    }

    //получение важных сообщений по выбранной аптеке
    getImportantMsgDrugStoreScene() {
        const getImportantMsgDrugStore = new Scenes.BaseScene("getImportantMsgDrugStore");
        getImportantMsgDrugStore.enter( (ctx) => {
            ctx.reply(`Выберите аптеку`, Markup.keyboard(arDrugStore).oneTime().resize(), {parse_mode: 'HTML'})
            ctx.reply(`Вернуться назад или в главное меню`, backMainMenu)
        });
        getImportantMsgDrugStore.action('mainMenu', async ctx => {
            arDrugStore.length = 0;
            ctx.scene.leave()
            await ctx.reply(`Выберите, что вас интересует`, mainMenu)
        })
        getImportantMsgDrugStore.action('back', ctx => {
            arDrugStore.length = 0;
            ctx.scene.leave()
            ctx.scene.enter('getListImportantMsgDrugStore')
        })
        getImportantMsgDrugStore.on(message('text'), async ctx  => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что вас интересует`, mainMenu)
            }
            let arResImportant = [];
            for (let i in idAptImportant) {
                if (msg === `Аптека №${idAptImportant[i]} на ${adressImportant[i]}`) {
                    arResImportant.push(`Важное сообщение для аптеки № ${idAptImportant[i]} по адресу ${adressImportant[i]}: ${nameImportant[i]}\n`);
                } else  {
                    continue
                }
            }
            if (arResImportant.length > 0) {
                ctx.reply(arResImportant.join(''), {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: backMainMenu.reply_markup})
            } else {
                ctx.reply(`В выбранной аптеке сейчас нет важных сообщений 😔`, backMainMenu);
            }
            
            arDrugStore.length = 0;
        })
        getImportantMsgDrugStore.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return getImportantMsgDrugStore;
    }
}

export default SceneGenerator
