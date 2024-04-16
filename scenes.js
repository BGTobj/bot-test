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
//получение данных из google-sheets

const appMailer = express()
appMailer.use(bodyParser.json())

const db = new sqlite3.Database('bot.db');
let sql;
let userId;
let userCity;
let userDrugStoreId;
let userDrugStoreAdress;
//let errorMsg;
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

const deleteFavoriteKeyboard = Markup.inlineKeyboard(
    [Markup.button.callback('Удалить из избранного', 'deleteFavorite'), Markup.button.callback('В главное меню', 'mainMenu')],).oneTime().resize()

const insertFavoriteKeyboard = Markup.inlineKeyboard(
    [Markup.button.callback('Добавить в избранное', 'insertFavorite'), Markup.button.callback('В главное меню', 'mainMenu')],).oneTime().resize()

const fullRegions = [];
let regions = [];
let cities = [];
let idApt = [];
let adress = [];
let schedule = [];
let urlYm = [];
let arCity = [];
let arDrugStore = [];
const getInfo = async () => {
    await doc.loadInfo()
    const aptekiSheet = doc.sheetsByIndex[0];
    const rows = await aptekiSheet.getRows();
for (let key in rows) {
    fullRegions.push(rows[key].get('region'));
    cities.push(rows[key].get('city'))
    idApt.push(rows[key].get('id_apt'));
    adress.push(rows[key].get('adress'));
    schedule.push(rows[key].get('schedule'));
    urlYm.push(rows[key].get('urlYM'));
}
regions = Array.from(new Set(fullRegions));
}
getInfo();
const buttons = ['Поблагодарить нас', 'Предложить идеи для улучшения', 'Отзыв о работе аптеки/сотрудника', 'Отзыв о наших товарах', 'В главное меню'];
let userMessage = ''
let userEmail = 'Не указал'
let adressDrugStore = 'Не указал'
const backMainMenu = Markup.inlineKeyboard(
    [Markup.button.callback('В главное меню', 'mainMenu'),],
    )
// Handler factories
const { enter, leave } = Scenes.Stage;

class SceneGenerator {
    getPromoScene() {
        const promo = new Scenes.BaseScene("promo");
        promo.enter( (ctx) => {
            ctx.reply(`Выберите населенный пункт`, Markup.keyboard(regions).oneTime().resize(), {parse_mode: 'HTML'})
        });
        promo.on(message('text'), async ctx => {
            let regionPromo = [];
            let namePromo = [];
            let datePromo = [];
            const msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что Вас интересует`, mainMenu)
            }
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
                    await ctx.reply(`${datePromo[key]} проходит акция "${namePromo[key]}", для уточнения подробностей акции переходите по <a href="https://monastirev.ru/promotions/">ссылке</a>`, {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: backMainMenu.reply_markup});
                }
            }
            ctx.scene.leave()
        });
        promo.on("message", (ctx) => {
            ctx.reply("Вы не выбрали населенный пункт");
            ctx.scene.reenter()
        });
        return promo;
    }

    sendQuestionScene() {
        const sendQuestion = new Scenes.BaseScene("sendQuestion");
        sendQuestion.enter( (ctx) => {
            ctx.reply(`Для связи с оператором, вы будете перенаправлены в отдельный чат. Наши сотрудники помогут Вам и ответят на все вопросы\nДля продолжения нажмите ПЕРЕЙТИ`, 
                Markup.inlineKeyboard(
                    [Markup.button.url('Перейти', GROUP_URL), Markup.button.callback('В главное меню', 'mainMenu'),],
                )
            )
            ctx.scene.leave()
        })
        sendQuestion.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что Вас интересует`, mainMenu)
        })
        sendQuestion.on("message", (ctx) => {
            ctx.reply("Ошибка");
            ctx.scene.leave()
        })
        return sendQuestion;    
    }

    getCityScene() {
        const getCity = new Scenes.BaseScene("getCity");
        getCity.enter( (ctx) => {
            ctx.reply(`Выберите населенный пункт`, Markup.keyboard(regions).oneTime().resize(), {parse_mode: 'HTML'})
        })
        getCity.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что Вас интересует`, mainMenu)
            }
            for (let i in fullRegions) {
                if (msg === fullRegions[i]) {
                    arCity.push(cities[i]);
                }
            }
            arCity = Array.from(new Set(arCity))
            if (arCity.length > 0) {
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

    getListDrugStoreScene() {
        const getListDrugStore = new Scenes.BaseScene("getListDrugStore");
        getListDrugStore.enter( (ctx) => {
            ctx.reply(`Выберите город`, Markup.keyboard(arCity).oneTime().resize(), {parse_mode: 'HTML'}) 
        })
        getListDrugStore.on(message('text'), async ctx  => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что Вас интересует`, mainMenu)
            }
            for (let i in fullRegions) {
                if (msg === cities[i]) {
                    arDrugStore.push(`Аптека №${idApt[i]} на ${adress[i]}`);
                    userCity = msg
                }
            }
            arCity.length = 0;
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

    getDrugStoreScene() {
        const getDrugStore = new Scenes.BaseScene("getDrugStore");
        getDrugStore.enter( (ctx) => {
            ctx.reply(`Выберите аптеку`, Markup.keyboard(arDrugStore).oneTime().resize(), {parse_mode: 'HTML'})
        })
        getDrugStore.on(message('text'), async ctx  => {
            userId = ctx.message.from.id;
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что Вас интересует`, mainMenu)
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
                            if (row) {
                                ctx.reply(`Аптека № ${idApt[i]} на ${adress[i]} г. ${cities[i]}, ${adress[i]}, режим работы ${schedule[i]}, <a href="${urlYm[i]}">как проехать</a>`, {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: deleteFavoriteKeyboard.reply_markup});
                            } else {
                                ctx.reply(`Аптека № ${idApt[i]} на ${adress[i]} г. ${cities[i]}, ${adress[i]}, режим работы ${schedule[i]}, <a href="${urlYm[i]}">как проехать</a>`, {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: insertFavoriteKeyboard.reply_markup});
                            }
                        });
                    })
                    //await ctx.reply(`Аптека № ${idApt[i]} на ${adress[i]} г. ${cities[i]}, ${adress[i]}, режим работы ${schedule[i]}, <a href="${urlYm[i]}">как проехать</a>`, {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: keyboardFavorite.reply_markup});
                        //ctx.scene.leave();
                        /* ctx.scene.enter('insertFavoriteDrugstore')
                        ctx.scene.enter('deleteFavoriteDrugstore') */
                }
            }
            arDrugStore.length = 0;
            //ctx.scene.leave();
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
            await ctx.reply(`Выберите, что Вас интересует`, mainMenu)
        })
        getDrugStore.on(message, ctx => {
            ctx.scene.leave()
            ctx.reply(`Ошибка`, backMainMenu)
        })
        return getDrugStore;
    }

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
                        return ctx.reply(`Вы не добавили аптеку в избранное`, backMainMenu)
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

    sendReviewScene() {
        const sendReview = new Scenes.BaseScene("sendReview");
        sendReview.enter((ctx) => {
            ctx.reply(`Выберите нужное`, Markup.keyboard(buttons).oneTime().resize(), {parse_mode: 'HTML'})
        })
        sendReview.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg === "Отзыв о работе аптеки/сотрудника") {
                ctx.scene.leave()
                ctx.scene.enter('getReviewMessageMan')
            } else if (msg === "В главное меню" || msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что Вас интересует`, mainMenu)
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

    getReviewMessageManScene() {
        const getReviewMessageMan = new Scenes.BaseScene("getReviewMessageMan");
        getReviewMessageMan.enter((ctx) => {
            ctx.reply(`Укажите, пожалуйста, адрес аптеки в формате "улица дом"`, backMainMenu)
        })
        getReviewMessageMan.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что Вас интересует`, mainMenu)
            }
            for (let i in adress) {
                if (msg === adress[i]) {
                    adressDrugStore = msg
                    ctx.scene.leave()
                    ctx.scene.enter('getReviewMessage')
                } else {
                    ctx.scene.leave()
                }
            }
        })
        getReviewMessageMan.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что Вас интересует`, mainMenu)
        })
        getReviewMessageMan.on(message, async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Ошибка`, backMainMenu)
        })
        return getReviewMessageMan;
    }

    getReviewMessageScene() {
        const getReviewMessage = new Scenes.BaseScene("getReviewMessage");
        getReviewMessage.enter((ctx) => {
            ctx.reply(`Напишите, пожалуйста, Ваш отзыв или предложите идею для улучшения`, backMainMenu)
        })
        getReviewMessage.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg.length === 0) {
                ctx.scene.reenter()
            } else if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что Вас интересует`, mainMenu)
            } else {
                userMessage = msg;
                ctx.reply(`Укажите, пожалуйста, адрес вашей электронной почты, телефон если желаете получить ответ`, Markup.inlineKeyboard(
                    [Markup.button.callback('Пропустить', 'Check'),],
                    ))
                ctx.scene.leave()
                ctx.scene.enter('getUserEmail')
            }
        })
        getReviewMessage.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что Вас интересует`, mainMenu)
        })
        getReviewMessage.on(message, async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Ошибка`, backMainMenu)
        })
        return getReviewMessage;
    }

    getUserEmailScene() {
        const getUserEmail = new Scenes.BaseScene("getUserEmail");
        getUserEmail.action('Check', (ctx) => {
            ctx.reply(`Нажмите кнопку "отправить", чтобы отправить сообщение нам на почту`, Markup.inlineKeyboard(
                [Markup.button.callback('Отправить', 'Send'),],
                ))
                ctx.scene.leave()
                ctx.scene.enter('postReview')
            })
        getUserEmail.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg === '/start') {
                ctx.scene.leave()
                ctx.reply(`Выберите, что Вас интересует`, mainMenu)
            } else {
                userEmail = msg;
            ctx.reply(`Нажмите кнопку "отправить", чтобы отправить сообщение нам на почту`, Markup.inlineKeyboard(
                [Markup.button.callback('Отправить', 'Send'),],
                ))
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

    postReviewScene() {
        const postReview = new Scenes.BaseScene("postReview");
        postReview.action('Send', async (ctx) => {
            const data = `Адрес аптеки: ${adressDrugStore}\nПочта пользователя: ${userEmail}\nСообщение: ${userMessage}`
            Mail.send(EMAIL_HOST_USER, data)
            ctx.reply(`Ваш вопрос передан в отдел контроля качества. Мы отвечаем в течение 2-х дней, но постараемся сделать это быстрее. Не забудьте проверить вашу почту и папку спам. Спасибо, что помогаете нам развиваться!`, backMainMenu)
            ctx.scene.leave()
            //ctx.scene.enter('sendReview')
        })
        postReview.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что Вас интересует`, mainMenu)
        })
        return postReview;
    }
}

export default SceneGenerator
