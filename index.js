import { Telegraf, Markup, Scenes, session } from 'telegraf'
import dotenv from 'dotenv'
dotenv.config()
import SceneGenerator from './scenes.js'
const curScene = new SceneGenerator()
const startPromo = curScene.startPromoScene()
const promo = curScene.getPromoScene()
const getPromoCity = curScene.getPromoCityScene()
const getListPromoDrugStore = curScene.getListPromoDrugStoreScene()
const getPromoDrugStore = curScene.getPromoDrugStoreScene()
const sendQuestion = curScene.sendQuestionScene()
const getCity = curScene.getCityScene()
const getListDrugStore = curScene.getListDrugStoreScene()
const getDrugStore = curScene.getDrugStoreScene()
const sendReview = curScene.sendReviewScene()
const getReviewMessage = curScene.getReviewMessageScene()
const getUserEmail = curScene.getUserEmailScene()
const postReview = curScene.postReviewScene()
const getReviewMessageMan = curScene.getReviewMessageManScene()
const myDrugStores = curScene.myDrugStoresScene()
const insertFavoriteDrugstore = curScene.insertFavoriteDrugstoreScene()
const deleteFavoriteDrugstore = curScene.deleteFavoriteDrugstoreScene()
const importantMessageCity = curScene.importantMessageCityScene()
const getImportantMessage = curScene.getImportantMessageScene()

const { BOT_TOKEN, GROUP_URL } = process.env
const bot = new Telegraf(BOT_TOKEN)

const stage = new Scenes.Stage([startPromo, promo, getPromoCity, getListPromoDrugStore, getPromoDrugStore, sendQuestion, getCity, getListDrugStore, getDrugStore, sendReview, getReviewMessage, getUserEmail, postReview, getReviewMessageMan, myDrugStores, insertFavoriteDrugstore, deleteFavoriteDrugstore, importantMessageCity, getImportantMessage]);
    bot.use(session());
    bot.use(stage.middleware());
    bot.hears("Акции и спецпредложения", async ctx => { 
        ctx.scene.enter("startPromo")
    });
    bot.hears("Задать вопрос", async ctx => {
        ctx.scene.leave();
        ctx.scene.enter("sendQuestion")
    });
    bot.hears("Адреса и график работы аптек", async ctx => { 
        ctx.scene.enter("getCity")
    });
    bot.hears("Оставить отзыв", async ctx => { 
        ctx.scene.enter("sendReview")
    });
    bot.hears("Мои аптеки", async ctx => {
        ctx.scene.enter("myDrugStores")
    });
    bot.hears("Важные сообщения", async ctx => {
        ctx.scene.enter("importantMessageCity")
    });
    //команда запуска бота с приветствием и выбор пункта из главного меню
    bot.start(async (ctx) => {
        const userFirstName = ctx.message.chat.first_name;
        await ctx.reply(`Здравствуйте, ${userFirstName}, Вы находитесь в телеграм-боте сети аптек "Монастырёв". Выберите, что Вас интересует`, mainMenu)
    });


//главное меню
const mainMenu = Markup
    .keyboard([
      'Акции и спецпредложения', 
      'Адреса и график работы аптек', 
      'Мои аптеки',
      'Оставить отзыв',
      'Задать вопрос',
      'Важные сообщения',
      'Наш телеграм-канал',
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

bot.hears(`Наш телеграм-канал`, ctx => {
    ctx.reply(`Переход в группу сети аптек "Монастырёв"\nДля продолжения нажмите ПЕРЕЙТИ`, 
                Markup.inlineKeyboard(
                    [[Markup.button.url('Перейти', GROUP_URL)],
                    [Markup.button.callback('В главное меню', 'mainMenu')],],
                )
            )
})


bot.launch()

